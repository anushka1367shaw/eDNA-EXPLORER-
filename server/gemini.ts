import { GoogleGenAI } from '@google/genai';
import type { BiodiversityMetrics, DatasetRecord, TaxonomicResult } from '../src/types';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
}

const SCIENTIFIC_SYSTEM_INSTRUCTION = `You are the Scientific Interpretation Assistant for eDNA Explorer, an environmental DNA (eDNA) biodiversity research platform.
Follow these strict scientific principles at all times:
1. Ground every numerical figure, species name, and diversity index strictly in the provided dataset context. Never invent species, read counts, or metrics not present in the context.
2. Clearly distinguish direct observations (what appears in the sequencing table or calculated indices) from ecological interpretations (what those patterns might suggest).
3. Explicitly note scientific limitations and sources of uncertainty in eDNA metabarcoding: PCR amplification bias, primer specificity, DNA shedding and degradation rates, transport in water/soil, incomplete reference databases, and the critical fact that eDNA read counts are NOT automatically equivalent to organism biomass or population abundance.
4. Never claim AI-generated summaries represent confirmed scientific evidence; frame them as interpretive research assistance requiring ecological and laboratory validation.
5. Be concise, precise, and structured using clean Markdown headings and bullet points.`;

function formatDatasetContext(
  dataset: DatasetRecord | null,
  taxonomicResults: TaxonomicResult[],
  metrics: BiodiversityMetrics | null
): string {
  if (!dataset) {
    return 'No specific dataset is currently selected. Answer general eDNA methodology or biodiversity index questions accurately while noting no dataset is attached.';
  }

  const topTaxa = taxonomicResults.slice(0, 25).map((t) => ({
    scientific_name: t.scientific_name,
    common_name: t.common_name,
    rank: t.taxonomic_rank,
    phylum: t.phylum_name,
    read_count: t.read_count,
    similarity_score: t.similarity_score,
    status: t.identification_status,
    database: t.reference_database,
  }));

  return JSON.stringify(
    {
      dataset: {
        name: dataset.dataset_name,
        sample_id: dataset.sample_id,
        location: dataset.sample_location,
        collection_date: dataset.collection_date,
        sample_type: dataset.sample_type,
        format: dataset.file_format,
        status: dataset.status,
      },
      biodiversity_metrics: metrics
        ? {
            species_richness: metrics.species_richness,
            total_reads: metrics.total_reads,
            shannon_index_H: metrics.shannon_index,
            simpson_dominance_D: metrics.simpson_index,
            simpson_diversity_1_minus_D: metrics.simpson_diversity,
            pielou_evenness_J: metrics.pielou_evenness,
            is_demonstration: metrics.is_demonstration,
          }
        : null,
      taxonomic_identifications_sample: topTaxa,
    },
    null,
    2
  );
}

export async function askScientificAssistant(params: {
  question: string;
  dataset: DatasetRecord | null;
  taxonomicResults: TaxonomicResult[];
  metrics: BiodiversityMetrics | null;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
}): Promise<string> {
  const ai = getGeminiClient();
  const contextJson = formatDatasetContext(params.dataset, params.taxonomicResults, params.metrics);

  const historyText = (params.history ?? [])
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Researcher' : 'Assistant'}: ${m.text}`)
    .join('\n\n');

  const prompt = `Attached Scientific Context:
${contextJson}

${historyText ? `Recent Conversation:\n${historyText}\n\n` : ''}Researcher Question:
${params.question}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction: SCIENTIFIC_SYSTEM_INSTRUCTION,
    },
  });

  return response.text || 'No response generated.';
}

export async function generateScientificReportSummary(params: {
  dataset: DatasetRecord;
  taxonomicResults: TaxonomicResult[];
  metrics: BiodiversityMetrics | null;
}): Promise<string> {
  const ai = getGeminiClient();
  const contextJson = formatDatasetContext(params.dataset, params.taxonomicResults, params.metrics);

  const prompt = `Generate a concise, structured scientific report summary (Observations, Ecological Interpretation, Limitations & Next Steps) strictly grounded in the following eDNA dataset context:

${contextJson}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction: SCIENTIFIC_SYSTEM_INSTRUCTION,
    },
  });

  return response.text || '';
}
