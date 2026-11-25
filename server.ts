import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { getFirebaseProjectId, requireAdmin, requireAuth, requireVerifiedEmail } from './server/auth';
import {
  buildDatasetPreview,
  calculateBiodiversityMetrics,
  detectDatasetFormat,
  getSampleDatasets,
  lookupBoldTaxon,
  lookupNcbiTaxon,
  MAX_DATASET_BYTES,
  runTaxonomicPipeline,
} from './server/bioinformatics';
import { askScientificAssistant, generateScientificReportSummary, isGeminiConfigured } from './server/gemini';
import {
  addSystemLog,
  deleteDatasetById,
  getAdminAggregateStats,
  getBiodiversityMetricsByDataset,
  getDatasetById,
  getSystemLogs,
  getTaxonomicResults,
  insertDataset,
  isSupabaseConfigured,
  listAllDatasetsAdmin,
  listAllTaxonomicResultsForUser,
  listAnalysisJobsForUser,
  listBiodiversityMetricsForUser,
  listDatasetsForUser,
  listReportsForUser,
  readUploadedFileContent,
  saveAnalysisJob,
  saveBiodiversityMetrics,
  saveReport,
  saveTaxonomicResults,
  saveUploadedFile,
  updateDatasetStatus,
} from './server/store';
import type { AnalysisJob, DatasetRecord, ReportRecord } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '2mb' }));

// Sliding-window rate limiter for expensive operations (analysis & Gemini AI)
const rateBuckets = new Map<string, number[]>();
function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.user?.uid || req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const timestamps = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= maxRequests) {
      res.status(429).json({
        error: 'Rate limit exceeded for intensive scientific processing. Please wait a moment before retrying.',
      });
      return;
    }
    timestamps.push(now);
    rateBuckets.set(key, timestamps);
    next();
  };
}

const analysisRateLimit = createRateLimiter(12, 60_000);
const aiRateLimit = createRateLimiter(15, 60_000);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DATASET_BYTES },
});

// Public health & status
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'edna-explorer' });
});

app.get('/api/system/status', (_req, res) => {
  const supabaseConfigured = isSupabaseConfigured();
  res.json({
    supabaseConfigured,
    storageMode: supabaseConfigured ? 'supabase' : 'local_sandbox',
    geminiConfigured: isGeminiConfigured(),
    firebaseProjectId: getFirebaseProjectId(),
    ncbiLookupEnabled: true,
  });
});

// Current authenticated user server-side role verification (never trusts frontend role claims)
app.get('/api/auth/session', requireAuth, (req, res) => {
  res.json({
    uid: req.user!.uid,
    email: req.user!.email,
    emailVerified: req.user!.emailVerified,
    isAdmin: req.user!.isAdmin,
  });
});

// Curated demonstration datasets
app.get('/api/datasets/samples', requireAuth, (_req, res) => {
  const samples = getSampleDatasets();
  res.json({
    samples: Object.entries(samples).map(([key, s]) => ({
      key,
      name: s.name,
      filename: s.filename,
      format: s.format,
      sampleId: s.sampleId,
      location: s.location,
      sampleType: s.sampleType,
      description: s.description,
    })),
  });
});

app.post('/api/datasets/load-sample', requireAuth, requireVerifiedEmail, async (req, res) => {
  try {
    const { sampleKey, projectId } = req.body as { sampleKey?: string; projectId?: string };
    const samples = getSampleDatasets();
    const sample = sampleKey ? samples[sampleKey] : undefined;
    if (!sample) {
      res.status(400).json({ error: 'Unknown sample dataset preset.' });
      return;
    }

    const datasetId = crypto.randomUUID();
    const buffer = Buffer.from(sample.content, 'utf-8');
    const preview = buildDatasetPreview(sample.content, sample.format);
    const storagePath = await saveUploadedFile(req.user!.uid, datasetId, sample.filename, buffer, 'text/plain');
    const now = new Date().toISOString();

    const record: DatasetRecord = {
      id: datasetId,
      firebase_uid: req.user!.uid,
      project_id: projectId || null,
      dataset_name: sample.name,
      sample_id: sample.sampleId,
      file_path: storagePath,
      file_format: sample.format,
      file_size_bytes: buffer.byteLength,
      sample_location: sample.location,
      collection_date: new Date().toISOString().slice(0, 10),
      sample_type: sample.sampleType,
      organism_group: 'Mixed Aquatic & Riparian (Demo)',
      description: sample.description,
      status: 'validated',
      preview_summary: preview,
      created_at: now,
      updated_at: now,
    };

    const saved = await insertDataset(record);
    addSystemLog('info', 'dataset-sample', `Loaded demonstration dataset "${sample.name}"`, req.user!.uid);
    res.status(201).json({ dataset: saved });
  } catch (err) {
    addSystemLog('error', 'dataset-sample', err instanceof Error ? err.message : String(err), req.user?.uid);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load demonstration sample.' });
  }
});

// Upload dataset (multipart form)
app.post(
  '/api/datasets/upload',
  requireAuth,
  requireVerifiedEmail,
  upload.single('file'),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No dataset file provided.' });
        return;
      }

      const format = detectDatasetFormat(file.originalname);
      if (!format) {
        res.status(400).json({
          error: 'Unsupported file extension. Allowed formats: .csv, .tsv, .fasta, .fa, .fna, .fastq, .fq, .txt',
        });
        return;
      }

      const {
        datasetName,
        sampleId,
        sampleLocation,
        collectionDate,
        sampleType,
        organismGroup,
        description,
        projectId,
      } = req.body as Record<string, string>;

      if (!datasetName?.trim() || !sampleId?.trim() || !sampleLocation?.trim() || !collectionDate?.trim() || !sampleType?.trim()) {
        res.status(400).json({
          error: 'Required metadata missing: datasetName, sampleId, sampleLocation, collectionDate, and sampleType are required.',
        });
        return;
      }

      const content = file.buffer.toString('utf-8');
      const preview = buildDatasetPreview(content, format);
      const datasetId = crypto.randomUUID();
      const storagePath = await saveUploadedFile(req.user!.uid, datasetId, file.originalname, file.buffer, file.mimetype);
      const now = new Date().toISOString();

      const record: DatasetRecord = {
        id: datasetId,
        firebase_uid: req.user!.uid,
        project_id: projectId?.trim() || null,
        dataset_name: datasetName.trim().slice(0, 150),
        sample_id: sampleId.trim().slice(0, 100),
        file_path: storagePath,
        file_format: format,
        file_size_bytes: file.size,
        sample_location: sampleLocation.trim().slice(0, 200),
        collection_date: collectionDate.trim(),
        sample_type: sampleType.trim().slice(0, 100),
        organism_group: organismGroup?.trim().slice(0, 120) || null,
        description: description?.trim().slice(0, 1000) || null,
        status: 'validated',
        preview_summary: preview,
        created_at: now,
        updated_at: now,
      };

      const saved = await insertDataset(record);
      addSystemLog('info', 'dataset-upload', `Uploaded dataset ${saved.dataset_name} (${format.toUpperCase()})`, req.user!.uid);
      res.status(201).json({ dataset: saved });
    } catch (err) {
      addSystemLog('error', 'dataset-upload', err instanceof Error ? err.message : String(err), req.user?.uid);
      res.status(400).json({ error: err instanceof Error ? err.message : 'Dataset validation or upload failed.' });
    }
  }
);

// List user's datasets
app.get('/api/datasets', requireAuth, async (req, res) => {
  try {
    const datasets = await listDatasetsForUser(req.user!.uid);
    res.json({ datasets });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list datasets.' });
  }
});

// Get single dataset + its taxonomic results + metrics
app.get('/api/datasets/:id', requireAuth, async (req, res) => {
  try {
    const datasetId = String(req.params.id);
    const dataset = await getDatasetById(datasetId);
    if (!dataset) {
      res.status(404).json({ error: 'Dataset not found.' });
      return;
    }
    if (dataset.firebase_uid !== req.user!.uid && !req.user!.isAdmin) {
      res.status(403).json({ error: 'Forbidden. You do not own this dataset.' });
      return;
    }

    const [taxonomicResults, biodiversityMetrics] = await Promise.all([
      getTaxonomicResults(dataset.id),
      getBiodiversityMetricsByDataset(dataset.id),
    ]);

    res.json({ dataset, taxonomicResults, biodiversityMetrics });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to retrieve dataset.' });
  }
});

// Delete user dataset
app.delete('/api/datasets/:id', requireAuth, async (req, res) => {
  try {
    const datasetId = String(req.params.id);
    const dataset = await getDatasetById(datasetId);
    if (!dataset) {
      res.status(404).json({ error: 'Dataset not found.' });
      return;
    }
    if (dataset.firebase_uid !== req.user!.uid && !req.user!.isAdmin) {
      res.status(403).json({ error: 'Forbidden. You do not own this dataset.' });
      return;
    }

    await deleteDatasetById(dataset.id);
    addSystemLog('info', 'dataset-delete', `Deleted dataset ${dataset.dataset_name}`, req.user!.uid);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete dataset.' });
  }
});

// Run Taxonomic Identification + Biodiversity Metrics calculation
app.post(
  '/api/datasets/:id/analyze',
  requireAuth,
  requireVerifiedEmail,
  analysisRateLimit,
  async (req, res) => {
    const datasetId = String(req.params.id);
    const jobId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    try {
      const dataset = await getDatasetById(datasetId);
      if (!dataset) {
        res.status(404).json({ error: 'Dataset not found.' });
        return;
      }
      if (dataset.firebase_uid !== req.user!.uid && !req.user!.isAdmin) {
        res.status(403).json({ error: 'Forbidden.' });
        return;
      }

      const {
        referenceDatabase = 'NCBI_NT',
        enableExternalLookup = true,
        demonstrationMode = false,
      } = req.body as {
        referenceDatabase?: string;
        enableExternalLookup?: boolean;
        demonstrationMode?: boolean;
      };

      await updateDatasetStatus(dataset.id, 'processing');

      const job: AnalysisJob = {
        id: jobId,
        dataset_id: dataset.id,
        firebase_uid: dataset.firebase_uid,
        job_type: 'full_pipeline',
        reference_database: referenceDatabase,
        status: 'running',
        is_demonstration: Boolean(demonstrationMode),
        error_message: null,
        started_at: startedAt,
        completed_at: null,
      };
      await saveAnalysisJob(job);

      const rawContent = await readUploadedFileContent(dataset.firebase_uid, dataset.id, dataset.file_path);
      const { results, isDemonstration, notes } = await runTaxonomicPipeline({
        datasetId: dataset.id,
        firebaseUid: dataset.firebase_uid,
        format: dataset.file_format,
        rawContent,
        referenceDatabase,
        enableExternalLookup: Boolean(enableExternalLookup),
        demonstrationMode: Boolean(demonstrationMode),
      });

      await saveTaxonomicResults(dataset.id, results);

      const computed = calculateBiodiversityMetrics(results);
      const metricsRecord = await saveBiodiversityMetrics({
        id: crypto.randomUUID(),
        dataset_id: dataset.id,
        sample_id: null,
        firebase_uid: dataset.firebase_uid,
        species_richness: computed.species_richness,
        total_reads: computed.total_reads,
        shannon_index: computed.shannon_index,
        simpson_index: computed.simpson_index,
        simpson_diversity: computed.simpson_diversity,
        pielou_evenness: computed.pielou_evenness,
        relative_abundances: computed.relative_abundances,
        is_demonstration: isDemonstration,
        calculated_at: new Date().toISOString(),
      });

      await updateDatasetStatus(dataset.id, 'analyzed');
      await saveAnalysisJob({
        ...job,
        status: 'completed',
        is_demonstration: isDemonstration,
        completed_at: new Date().toISOString(),
      });

      addSystemLog(
        'info',
        'analysis-pipeline',
        `Completed taxonomic & biodiversity analysis on ${dataset.dataset_name} (${results.length} records)`,
        req.user!.uid
      );

      res.json({
        datasetId: dataset.id,
        taxonomicResults: results,
        biodiversityMetrics: metricsRecord,
        isDemonstration,
        notes,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis pipeline failed.';
      await updateDatasetStatus(datasetId, 'failed').catch(() => undefined);
      await saveAnalysisJob({
        id: jobId,
        dataset_id: datasetId,
        firebase_uid: req.user!.uid,
        job_type: 'full_pipeline',
        reference_database: 'NCBI_NT',
        status: 'failed',
        is_demonstration: false,
        error_message: msg,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      }).catch(() => undefined);
      addSystemLog('error', 'analysis-pipeline', msg, req.user?.uid);
      res.status(500).json({ error: msg });
    }
  }
);

// Live NCBI Taxonomy / BOLD taxon lookup endpoint
app.get('/api/taxonomic/lookup', requireAuth, async (req, res) => {
  const query = String(req.query.q || '').trim();
  const db = String(req.query.db || 'NCBI_NT');
  if (!query || query.length > 120) {
    res.status(400).json({ error: 'Provide a valid taxon query (1-120 characters).' });
    return;
  }

  const result = db === 'BOLD' ? await lookupBoldTaxon(query) : await lookupNcbiTaxon(query);
  res.json({ query, database: db, match: result });
});

app.get('/api/taxonomic/all', requireAuth, async (req, res) => {
  try {
    const results = await listAllTaxonomicResultsForUser(req.user!.uid);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch taxonomic records.' });
  }
});

app.get('/api/biodiversity/all', requireAuth, async (req, res) => {
  try {
    const metrics = await listBiodiversityMetricsForUser(req.user!.uid);
    res.json({ metrics });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch biodiversity metrics.' });
  }
});

app.get('/api/analysis-jobs', requireAuth, async (req, res) => {
  try {
    const jobs = await listAnalysisJobsForUser(req.user!.uid);
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load analysis jobs.' });
  }
});

// Reports
app.get('/api/reports', requireAuth, async (req, res) => {
  try {
    const reports = await listReportsForUser(req.user!.uid);
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list reports.' });
  }
});

app.post('/api/reports/generate', requireAuth, requireVerifiedEmail, aiRateLimit, async (req, res) => {
  try {
    const { datasetId, reportTitle, includeAiSummary } = req.body as {
      datasetId?: string;
      reportTitle?: string;
      includeAiSummary?: boolean;
    };

    if (!datasetId) {
      res.status(400).json({ error: 'datasetId is required.' });
      return;
    }

    const dataset = await getDatasetById(datasetId);
    if (!dataset) {
      res.status(404).json({ error: 'Dataset not found.' });
      return;
    }
    if (dataset.firebase_uid !== req.user!.uid && !req.user!.isAdmin) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }

    const [taxonomicResults, metrics] = await Promise.all([
      getTaxonomicResults(dataset.id),
      getBiodiversityMetricsByDataset(dataset.id),
    ]);

    let aiSummary: string | null = null;
    if (includeAiSummary && isGeminiConfigured()) {
      aiSummary = await generateScientificReportSummary({
        dataset,
        taxonomicResults,
        metrics,
      });
    }

    const report: ReportRecord = {
      id: crypto.randomUUID(),
      dataset_id: dataset.id,
      firebase_uid: dataset.firebase_uid,
      report_title: (reportTitle || `${dataset.dataset_name} — Biodiversity Report`).slice(0, 180),
      ai_summary: aiSummary,
      methodology_notes:
        'Sequence validation & parsing performed in eDNA Explorer. Diversity metrics computed via Shannon-Wiener (H\' = -Σ(pi ln pi)), Simpson Dominance (D = Σ pi²), Simpson Diversity (1 - D), and Pielou\'s Evenness (J = H\' / ln S). Taxonomic verification queried NCBI Taxonomy / BOLD where enabled.',
      limitations_notes:
        'Environmental DNA read counts reflect amplified DNA fragment frequencies and are NOT directly equivalent to organism abundance or biomass due to PCR primer bias, shedding variation, and transport dynamics. Any records labeled demonstration_match are illustrative only.',
      generated_at: new Date().toISOString(),
    };

    const saved = await saveReport(report);
    res.status(201).json({ report: saved });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate report.' });
  }
});

// Gemini AI Scientific Assistant
app.post('/api/ai/interpret', requireAuth, aiRateLimit, async (req, res) => {
  try {
    if (!isGeminiConfigured()) {
      res.status(503).json({
        error: 'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const { question, datasetId, history } = req.body as {
      question?: string;
      datasetId?: string;
      history?: Array<{ role: 'user' | 'assistant'; text: string }>;
    };

    if (!question?.trim() || question.length > 2000) {
      res.status(400).json({ error: 'Please provide a valid scientific question (1-2000 characters).' });
      return;
    }

    let dataset: DatasetRecord | null = null;
    let taxonomicResults: Awaited<ReturnType<typeof getTaxonomicResults>> = [];
    let metrics: Awaited<ReturnType<typeof getBiodiversityMetricsByDataset>> = null;

    if (datasetId) {
      const found = await getDatasetById(datasetId);
      if (found) {
        if (found.firebase_uid !== req.user!.uid && !req.user!.isAdmin) {
          res.status(403).json({ error: 'Forbidden. Cannot inspect another researcher dataset.' });
          return;
        }
        dataset = found;
        [taxonomicResults, metrics] = await Promise.all([
          getTaxonomicResults(found.id),
          getBiodiversityMetricsByDataset(found.id),
        ]);
      }
    }

    const answer = await askScientificAssistant({
      question: question.trim(),
      dataset,
      taxonomicResults,
      metrics,
      history,
    });

    res.json({ answer });
  } catch (err) {
    addSystemLog('error', 'gemini-assistant', err instanceof Error ? err.message : String(err), req.user?.uid);
    res.status(500).json({ error: err instanceof Error ? err.message : 'AI assistant request failed.' });
  }
});

// --- Hidden Administrator Endpoints (Server-Verified Privileges Required) ---
app.get('/api/admin/overview', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [stats, datasets] = await Promise.all([getAdminAggregateStats(), listAllDatasetsAdmin()]);
    res.json({ stats, datasets, logs: getSystemLogs() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load admin overview.' });
  }
});

app.delete('/api/admin/datasets/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const datasetId = String(req.params.id);
    const dataset = await getDatasetById(datasetId);
    if (!dataset) {
      res.status(404).json({ error: 'Dataset not found.' });
      return;
    }
    await deleteDatasetById(dataset.id);
    addSystemLog('warn', 'admin-moderation', `Admin removed dataset ${dataset.dataset_name} (${dataset.id})`, req.user!.uid);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to remove dataset.' });
  }
});

// Multer & API error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: `File upload error: ${err.message}` });
    return;
  }
  res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error.' });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`eDNA Explorer server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
