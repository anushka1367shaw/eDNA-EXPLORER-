import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import type {
  AnalysisJob,
  BiodiversityMetrics,
  DatasetRecord,
  ReportRecord,
  SystemLogEntry,
  TaxonomicResult,
} from '../src/types';

interface LocalDbState {
  datasets: DatasetRecord[];
  taxonomic_results: TaxonomicResult[];
  biodiversity_metrics: BiodiversityMetrics[];
  analysis_jobs: AnalysisJob[];
  reports: ReportRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const STORE_FILE = path.resolve(DATA_DIR, 'research_store.json');

const systemLogs: SystemLogEntry[] = [];

export function addSystemLog(level: SystemLogEntry['level'], source: string, message: string, uid?: string) {
  systemLogs.unshift({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
    uid,
  });
  if (systemLogs.length > 200) systemLogs.pop();
}

export function getSystemLogs(): SystemLogEntry[] {
  return systemLogs;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.SUPABASE_URL.startsWith('http')
  );
}

function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function ensureLocalDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function readLocalDb(): LocalDbState {
  ensureLocalDirs();
  if (!fs.existsSync(STORE_FILE)) {
    const empty: LocalDbState = {
      datasets: [],
      taxonomic_results: [],
      biodiversity_metrics: [],
      analysis_jobs: [],
      reports: [],
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(empty, null, 2), 'utf-8');
    return empty;
  }
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8')) as LocalDbState;
}

function writeLocalDb(state: LocalDbState) {
  ensureLocalDirs();
  fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function safeFilePath(uid: string, datasetId: string, filename: string): string {
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeId = datasetId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetDir = path.resolve(UPLOADS_DIR, safeUid, safeId);
  if (!targetDir.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error('Invalid storage path.');
  }
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  const resolved = path.resolve(targetDir, safeName);
  if (!resolved.startsWith(targetDir + path.sep)) {
    throw new Error('Invalid file path.');
  }
  return resolved;
}

export async function saveUploadedFile(
  uid: string,
  datasetId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${uid}/${datasetId}/${safeName}`;
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    const { error } = await supabase.storage
      .from('edna-datasets')
      .upload(storagePath, buffer, { contentType: mimeType || 'text/plain', upsert: true });
    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }
    return storagePath;
  }

  const localPath = safeFilePath(uid, datasetId, safeName);
  fs.writeFileSync(localPath, buffer);
  return storagePath;
}

export async function readUploadedFileContent(uid: string, datasetId: string, storagePath: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase.storage.from('edna-datasets').download(storagePath);
    if (error || !data) {
      throw new Error(`Failed to read dataset from Supabase Storage: ${error?.message || 'Missing file'}`);
    }
    return await data.text();
  }

  const fileName = path.basename(storagePath);
  const localPath = safeFilePath(uid, datasetId, fileName);
  if (!fs.existsSync(localPath)) {
    throw new Error('Dataset file not found in local sandbox storage.');
  }
  return fs.readFileSync(localPath, 'utf-8');
}

export async function insertDataset(record: DatasetRecord): Promise<DatasetRecord> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase.from('datasets').insert(record).select().single();
    if (error) throw new Error(`Supabase datasets insert failed: ${error.message}`);
    return data as DatasetRecord;
  }

  const db = readLocalDb();
  db.datasets.unshift(record);
  writeLocalDb(db);
  return record;
}

export async function listDatasetsForUser(uid: string): Promise<DatasetRecord[]> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .eq('firebase_uid', uid)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as DatasetRecord[];
  }
  return readLocalDb().datasets.filter((d) => d.firebase_uid === uid);
}

export async function listAllDatasetsAdmin(): Promise<DatasetRecord[]> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as DatasetRecord[];
  }
  return readLocalDb().datasets;
}

export async function getDatasetById(datasetId: string): Promise<DatasetRecord | null> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase.from('datasets').select('*').eq('id', datasetId).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as DatasetRecord) || null;
  }
  return readLocalDb().datasets.find((d) => d.id === datasetId) || null;
}

export async function updateDatasetStatus(
  datasetId: string,
  status: DatasetRecord['status']
): Promise<void> {
  const updatedAt = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase
      .from('datasets')
      .update({ status, updated_at: updatedAt })
      .eq('id', datasetId);
    if (error) throw new Error(error.message);
    return;
  }

  const db = readLocalDb();
  const item = db.datasets.find((d) => d.id === datasetId);
  if (item) {
    item.status = status;
    item.updated_at = updatedAt;
    writeLocalDb(db);
  }
}

export async function deleteDatasetById(datasetId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const existing = await getDatasetById(datasetId);
    if (existing?.file_path) {
      await supabase.storage.from('edna-datasets').remove([existing.file_path]);
    }
    const { error } = await supabase.from('datasets').delete().eq('id', datasetId);
    if (error) throw new Error(error.message);
    return;
  }

  const db = readLocalDb();
  db.datasets = db.datasets.filter((d) => d.id !== datasetId);
  db.taxonomic_results = db.taxonomic_results.filter((t) => t.dataset_id !== datasetId);
  db.biodiversity_metrics = db.biodiversity_metrics.filter((m) => m.dataset_id !== datasetId);
  db.analysis_jobs = db.analysis_jobs.filter((j) => j.dataset_id !== datasetId);
  db.reports = db.reports.filter((r) => r.dataset_id !== datasetId);
  writeLocalDb(db);
}

export async function saveTaxonomicResults(datasetId: string, results: TaxonomicResult[]): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    await supabase.from('taxonomic_results').delete().eq('dataset_id', datasetId);
    if (results.length > 0) {
      const { error } = await supabase.from('taxonomic_results').insert(results);
      if (error) throw new Error(error.message);
    }
    return;
  }

  const db = readLocalDb();
  db.taxonomic_results = db.taxonomic_results.filter((r) => r.dataset_id !== datasetId);
  db.taxonomic_results.push(...results);
  writeLocalDb(db);
}

export async function getTaxonomicResults(datasetId: string): Promise<TaxonomicResult[]> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('taxonomic_results')
      .select('*')
      .eq('dataset_id', datasetId)
      .order('read_count', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as TaxonomicResult[];
  }
  return readLocalDb()
    .taxonomic_results.filter((r) => r.dataset_id === datasetId)
    .sort((a, b) => b.read_count - a.read_count);
}

export async function listAllTaxonomicResultsForUser(uid: string): Promise<TaxonomicResult[]> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('taxonomic_results')
      .select('*')
      .eq('firebase_uid', uid);
    if (error) throw new Error(error.message);
    return (data ?? []) as TaxonomicResult[];
  }
  return readLocalDb().taxonomic_results.filter((r) => r.firebase_uid === uid);
}

export async function saveBiodiversityMetrics(metrics: BiodiversityMetrics): Promise<BiodiversityMetrics> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    await supabase.from('biodiversity_metrics').delete().eq('dataset_id', metrics.dataset_id);
    const { data, error } = await supabase.from('biodiversity_metrics').insert(metrics).select().single();
    if (error) throw new Error(error.message);
    return data as BiodiversityMetrics;
  }

  const db = readLocalDb();
  db.biodiversity_metrics = db.biodiversity_metrics.filter((m) => m.dataset_id !== metrics.dataset_id);
  db.biodiversity_metrics.unshift(metrics);
  writeLocalDb(db);
  return metrics;
}

export async function listBiodiversityMetricsForUser(uid: string): Promise<BiodiversityMetrics[]> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('biodiversity_metrics')
      .select('*')
      .eq('firebase_uid', uid)
      .order('calculated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as BiodiversityMetrics[];
  }
  return readLocalDb().biodiversity_metrics.filter((m) => m.firebase_uid === uid);
}

export async function getBiodiversityMetricsByDataset(datasetId: string): Promise<BiodiversityMetrics | null> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('biodiversity_metrics')
      .select('*')
      .eq('dataset_id', datasetId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as BiodiversityMetrics) || null;
  }
  return readLocalDb().biodiversity_metrics.find((m) => m.dataset_id === datasetId) || null;
}

export async function saveAnalysisJob(job: AnalysisJob): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase.from('analysis_jobs').upsert(job);
    if (error) throw new Error(error.message);
    return;
  }

  const db = readLocalDb();
  const idx = db.analysis_jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) db.analysis_jobs[idx] = job;
  else db.analysis_jobs.unshift(job);
  writeLocalDb(db);
}

export async function listAnalysisJobsForUser(uid: string): Promise<AnalysisJob[]> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('analysis_jobs')
      .select('*')
      .eq('firebase_uid', uid)
      .order('started_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as AnalysisJob[];
  }
  return readLocalDb().analysis_jobs.filter((j) => j.firebase_uid === uid);
}

export async function saveReport(report: ReportRecord): Promise<ReportRecord> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase.from('reports').insert(report).select().single();
    if (error) throw new Error(error.message);
    return data as ReportRecord;
  }

  const db = readLocalDb();
  db.reports.unshift(report);
  writeLocalDb(db);
  return report;
}

export async function listReportsForUser(uid: string): Promise<ReportRecord[]> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('firebase_uid', uid)
      .order('generated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ReportRecord[];
  }
  return readLocalDb().reports.filter((r) => r.firebase_uid === uid);
}

export async function getAdminAggregateStats(): Promise<{
  totalDatasets: number;
  totalAnalyses: number;
  failedJobs: number;
  totalSpeciesRecords: number;
  totalStorageBytes: number;
  allJobs: AnalysisJob[];
  allMetrics: BiodiversityMetrics[];
}> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const [ds, jobs, tax, metrics] = await Promise.all([
      supabase.from('datasets').select('file_size_bytes'),
      supabase.from('analysis_jobs').select('*').order('started_at', { ascending: false }).limit(50),
      supabase.from('taxonomic_results').select('id', { count: 'exact', head: true }),
      supabase.from('biodiversity_metrics').select('*').order('calculated_at', { ascending: false }).limit(50),
    ]);
    const datasetList = (ds.data ?? []) as Array<{ file_size_bytes: number }>;
    const jobList = (jobs.data ?? []) as AnalysisJob[];
    const metricList = (metrics.data ?? []) as BiodiversityMetrics[];
    return {
      totalDatasets: datasetList.length,
      totalAnalyses: jobList.length,
      failedJobs: jobList.filter((j) => j.status === 'failed').length,
      totalSpeciesRecords: tax.count ?? 0,
      totalStorageBytes: datasetList.reduce((acc, d) => acc + (Number(d.file_size_bytes) || 0), 0),
      allJobs: jobList,
      allMetrics: metricList,
    };
  }

  const db = readLocalDb();
  return {
    totalDatasets: db.datasets.length,
    totalAnalyses: db.analysis_jobs.length,
    failedJobs: db.analysis_jobs.filter((j) => j.status === 'failed').length,
    totalSpeciesRecords: db.taxonomic_results.length,
    totalStorageBytes: db.datasets.reduce((acc, d) => acc + (d.file_size_bytes || 0), 0),
    allJobs: db.analysis_jobs,
    allMetrics: db.biodiversity_metrics,
  };
}
