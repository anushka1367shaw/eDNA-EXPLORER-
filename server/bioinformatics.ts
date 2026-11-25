import type {
  CsvPreview,
  DatasetFormat,
  DatasetPreview,
  RelativeAbundanceEntry,
  SequencePreview,
  TaxonomicResult,
} from '../src/types';

export const ALLOWED_EXTENSIONS: Record<string, DatasetFormat> = {
  '.csv': 'csv',
  '.tsv': 'tsv',
  '.fasta': 'fasta',
  '.fa': 'fasta',
  '.fna': 'fasta',
  '.fastq': 'fastq',
  '.fq': 'fastq',
  '.txt': 'txt',
};

export const MAX_DATASET_BYTES = 25 * 1024 * 1024; // 25 MB

export function detectDatasetFormat(filename: string): DatasetFormat | null {
  const lower = filename.toLowerCase();
  for (const [ext, fmt] of Object.entries(ALLOWED_EXTENSIONS)) {
    if (lower.endsWith(ext)) return fmt;
  }
  return null;
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsvOrTsv(
  content: string,
  delimiter: ',' | '\t'
): { preview: CsvPreview; allRows: Record<string, string>[] } {
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('The uploaded tabular file is empty.');
  }

  const headers = splitDelimitedLine(lines[0], delimiter).map((h, idx) => h || `column_${idx + 1}`);
  const allRows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitDelimitedLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });
    allRows.push(row);
  }

  const findHeader = (candidates: string[]) =>
    headers.find((h) => candidates.some((c) => h.toLowerCase().includes(c)));

  const detectedColumns = {
    sequenceId: findHeader(['sequence_id', 'seq_id', 'asv', 'otu', 'id', 'accession']),
    sequence: findHeader(['sequence', 'seq', 'dna', 'nucleotide']),
    scientificName: findHeader(['scientific_name', 'species', 'taxon', 'organism', 'taxonomy']),
    readCount: findHeader(['read_count', 'reads', 'count', 'abundance', 'frequency']),
    similarity: findHeader(['similarity', 'identity', 'confidence', 'score', 'pident']),
  };

  return {
    preview: {
      kind: 'tabular',
      headers,
      rows: allRows.slice(0, 20),
      totalRows: allRows.length,
      detectedColumns,
    },
    allRows,
  };
}

export interface ParsedSequence {
  id: string;
  header: string;
  sequence: string;
  gcPct: number;
  meanQuality: number | null;
}

export function parseSequenceFile(
  content: string,
  format: 'fasta' | 'fastq' | 'txt'
): { preview: SequencePreview; sequences: ParsedSequence[] } {
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  const sequences: ParsedSequence[] = [];

  if (format === 'fastq' || (format === 'txt' && lines[0]?.startsWith('@'))) {
    for (let i = 0; i < lines.length; i++) {
      const headerLine = lines[i]?.trim();
      if (!headerLine || !headerLine.startsWith('@')) continue;
      const seqLine = (lines[i + 1] ?? '').trim().toUpperCase();
      const plusLine = (lines[i + 2] ?? '').trim();
      const qualLine = (lines[i + 3] ?? '').trim();
      if (!seqLine || !plusLine.startsWith('+')) continue;
      i += 3;

      const id = headerLine.slice(1).split(/\s+/)[0] || `SEQ_${sequences.length + 1}`;
      const gcCount = (seqLine.match(/[GC]/g) || []).length;
      const gcPct = seqLine.length > 0 ? Number(((gcCount / seqLine.length) * 100).toFixed(2)) : 0;

      let meanQuality: number | null = null;
      if (qualLine.length > 0) {
        let sumQ = 0;
        for (let q = 0; q < qualLine.length; q++) {
          sumQ += qualLine.charCodeAt(q) - 33;
        }
        meanQuality = Number((sumQ / qualLine.length).toFixed(2));
      }

      sequences.push({ id, header: headerLine.slice(1), sequence: seqLine, gcPct, meanQuality });
    }
  } else {
    let currentHeader = '';
    let currentSeq = '';

    const flush = () => {
      const clean = currentSeq.replace(/\s+/g, '').toUpperCase();
      if (!clean) return;
      const id = (currentHeader.split(/\s+/)[0] || `SEQ_${sequences.length + 1}`).replace(/^>/, '');
      const gcCount = (clean.match(/[GC]/g) || []).length;
      const gcPct = Number(((gcCount / clean.length) * 100).toFixed(2));
      sequences.push({
        id,
        header: currentHeader || id,
        sequence: clean,
        gcPct,
        meanQuality: null,
      });
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('>')) {
        flush();
        currentHeader = line.slice(1).trim();
        currentSeq = '';
      } else {
        currentSeq += line;
      }
    }
    flush();

    if (sequences.length === 0 && format === 'txt') {
      // Check if plain line-delimited DNA sequences
      lines
        .map((l) => l.trim().toUpperCase())
        .filter((l) => /^[ATGCNRYSWKMBDHV]+$/.test(l) && l.length >= 15)
        .forEach((seq, idx) => {
          const gcCount = (seq.match(/[GC]/g) || []).length;
          sequences.push({
            id: `LINE_SEQ_${idx + 1}`,
            header: `LINE_SEQ_${idx + 1}`,
            sequence: seq,
            gcPct: Number(((gcCount / seq.length) * 100).toFixed(2)),
            meanQuality: null,
          });
        });
    }
  }

  if (sequences.length === 0) {
    throw new Error('No valid nucleotide sequences were detected in the uploaded file.');
  }

  let totalBases = 0;
  let totalGc = 0;
  let totalN = 0;
  let minLength = Infinity;
  let maxLength = 0;
  let qualSum = 0;
  let qualCount = 0;

  for (const seq of sequences) {
    const len = seq.sequence.length;
    totalBases += len;
    if (len < minLength) minLength = len;
    if (len > maxLength) maxLength = len;
    totalGc += (seq.sequence.match(/[GC]/g) || []).length;
    totalN += (seq.sequence.match(/N/g) || []).length;
    if (seq.meanQuality !== null) {
      qualSum += seq.meanQuality;
      qualCount++;
    }
  }

  const preview: SequencePreview = {
    kind: 'sequence',
    format,
    sequenceCount: sequences.length,
    totalBases,
    minLength: minLength === Infinity ? 0 : minLength,
    maxLength,
    meanLength: Number((totalBases / sequences.length).toFixed(1)),
    gcContentPct: totalBases > 0 ? Number(((totalGc / totalBases) * 100).toFixed(2)) : 0,
    ambiguousBasePct: totalBases > 0 ? Number(((totalN / totalBases) * 100).toFixed(2)) : 0,
    meanQualityScore: qualCount > 0 ? Number((qualSum / qualCount).toFixed(2)) : null,
    sampleSequences: sequences.slice(0, 10).map((s) => ({
      id: s.id,
      header: s.header,
      length: s.sequence.length,
      gcPct: s.gcPct,
      preview: s.sequence.length > 72 ? `${s.sequence.slice(0, 72)}...` : s.sequence,
    })),
  };

  return { preview, sequences };
}

export function buildDatasetPreview(content: string, format: DatasetFormat): DatasetPreview {
  if (format === 'csv') return parseCsvOrTsv(content, ',').preview;
  if (format === 'tsv') return parseCsvOrTsv(content, '\t').preview;
  if (format === 'txt') {
    const firstNonEmpty = content.split(/\r?\n/).find((l) => l.trim().length > 0) || '';
    if (!firstNonEmpty.startsWith('>') && !firstNonEmpty.startsWith('@') && firstNonEmpty.includes('\t')) {
      return parseCsvOrTsv(content, '\t').preview;
    }
    if (!firstNonEmpty.startsWith('>') && !firstNonEmpty.startsWith('@') && firstNonEmpty.includes(',')) {
      return parseCsvOrTsv(content, ',').preview;
    }
  }
  return parseSequenceFile(content, format).preview;
}

export function calculateBiodiversityMetrics(
  taxa: Array<{
    scientific_name: string;
    common_name?: string | null;
    phylum_name?: string | null;
    read_count: number;
  }>
): {
  species_richness: number;
  total_reads: number;
  shannon_index: number;
  simpson_index: number;
  simpson_diversity: number;
  pielou_evenness: number | null;
  relative_abundances: RelativeAbundanceEntry[];
} {
  const aggregated = new Map<
    string,
    { scientific_name: string; common_name: string | null; phylum_name: string | null; read_count: number }
  >();

  for (const item of taxa) {
    const name = (item.scientific_name || '').trim();
    const count = Number(item.read_count);
    if (!name || name.toLowerCase() === 'unclassified' || !Number.isFinite(count) || count <= 0) {
      continue;
    }
    const existing = aggregated.get(name);
    if (existing) {
      existing.read_count += count;
    } else {
      aggregated.set(name, {
        scientific_name: name,
        common_name: item.common_name ?? null,
        phylum_name: item.phylum_name ?? null,
        read_count: count,
      });
    }
  }

  const speciesList = Array.from(aggregated.values()).sort((a, b) => b.read_count - a.read_count);
  const speciesRichness = speciesList.length;
  const totalReads = speciesList.reduce((acc, s) => acc + s.read_count, 0);

  if (speciesRichness === 0 || totalReads === 0) {
    return {
      species_richness: 0,
      total_reads: 0,
      shannon_index: 0,
      simpson_index: 0,
      simpson_diversity: 0,
      pielou_evenness: null,
      relative_abundances: [],
    };
  }

  let shannon = 0;
  let simpsonD = 0;

  const relativeAbundances: RelativeAbundanceEntry[] = speciesList.map((sp) => {
    const pi = sp.read_count / totalReads;
    shannon += -1 * pi * Math.log(pi);
    simpsonD += pi * pi;
    return {
      scientific_name: sp.scientific_name,
      common_name: sp.common_name,
      phylum_name: sp.phylum_name,
      read_count: sp.read_count,
      relative_abundance: Number(pi.toFixed(6)),
      percentage: Number((pi * 100).toFixed(2)),
    };
  });

  const pielou = speciesRichness > 1 ? shannon / Math.log(speciesRichness) : null;

  return {
    species_richness: speciesRichness,
    total_reads: totalReads,
    shannon_index: Number(shannon.toFixed(4)),
    simpson_index: Number(simpsonD.toFixed(4)),
    simpson_diversity: Number((1 - simpsonD).toFixed(4)),
    pielou_evenness: pielou !== null ? Number(pielou.toFixed(4)) : null,
    relative_abundances: relativeAbundances,
  };
}

// Curated reference markers strictly for clearly-labeled Demonstration Mode sequence matching
interface ReferenceMarker {
  scientific_name: string;
  common_name: string;
  taxonomic_id: string;
  taxonomic_rank: string;
  domain_name: string;
  kingdom_name: string;
  phylum_name: string;
  class_name: string;
  order_name: string;
  family_name: string;
  genus_name: string;
  species_name: string;
  marker_sequence: string;
}

const DEMO_REFERENCE_MARKERS: ReferenceMarker[] = [
  {
    scientific_name: 'Salvelinus fontinalis',
    common_name: 'Brook Trout',
    taxonomic_id: '8038',
    taxonomic_rank: 'species',
    domain_name: 'Eukaryota',
    kingdom_name: 'Animalia',
    phylum_name: 'Chordata',
    class_name: 'Actinopterygii',
    order_name: 'Salmoniformes',
    family_name: 'Salmonidae',
    genus_name: 'Salvelinus',
    species_name: 'Salvelinus fontinalis',
    marker_sequence: 'CACTCTTTATCTTGTATTTGGTGCCTGAGCCGGTATAGTAGGAACAGCCCTAAGCCTACTAATTCGAGCAGAACTGAGCCAACCCGGCGCCCTTCTTGGAGACGACCAGATCTATAATGTCATCGTTACAGCCCATGCCTTCGTAATAATTTTCTTTATAGTAATACCAATTATAATCGGAGGCTTTGGAAACTGACTCATTCCACTAATGATTGGAGCCCCAGACATGGCATTCCCACGA',
  },
  {
    scientific_name: 'Hyla versicolor',
    common_name: 'Gray Treefrog',
    taxonomic_id: '30343',
    taxonomic_rank: 'species',
    domain_name: 'Eukaryota',
    kingdom_name: 'Animalia',
    phylum_name: 'Chordata',
    class_name: 'Amphibia',
    order_name: 'Anura',
    family_name: 'Hylidae',
    genus_name: 'Hyla',
    species_name: 'Hyla versicolor',
    marker_sequence: 'GGAACCCTCTACCTCGTATTCGGCGCATGAGCTGGGATAGTAGGAACTGCCCTTAGCCTATTAATTCGTGCAGAGTTAGGTCAACCTGGTGCCCTTCTAGGAGATGATCAAATTTACAATGTAGTCGTAACAGCTCATGCCTTCGTAATGATTTTCTTTATAGTTATACCTATTATAATTGGTGGCTTTGGAAACTGACTAGTCCCTTTAATAATCGGGGCCCCTGATATAGCATTTCCACGT',
  },
  {
    scientific_name: 'Oncorhynchus mykiss',
    common_name: 'Rainbow Trout',
    taxonomic_id: '8022',
    taxonomic_rank: 'species',
    domain_name: 'Eukaryota',
    kingdom_name: 'Animalia',
    phylum_name: 'Chordata',
    class_name: 'Actinopterygii',
    order_name: 'Salmoniformes',
    family_name: 'Salmonidae',
    genus_name: 'Oncorhynchus',
    species_name: 'Oncorhynchus mykiss',
    marker_sequence: 'ACACTGTATCTTGTCTTCGGCGCCTGAGCCGGAATAGTCGGCACCGCCTTAAGTCTCTTAATCCGGGCAGAACTAAGCCAACCTGGGGCTCTACTGGGGGACGACCAAATTTATAACGTAATCGTTACTGCCCATGCTTTCGTTATGATTTTCTTCATAGTAATGCCAATTATGATTGGGGGGTTCGGAAACTGATTAATCCCCTTGATGATCGGAGCCCCAGACATAGCATTCCCACGA',
  },
  {
    scientific_name: 'Baetis rhodani',
    common_name: 'Large Dark Olive Mayfly',
    taxonomic_id: '197152',
    taxonomic_rank: 'species',
    domain_name: 'Eukaryota',
    kingdom_name: 'Animalia',
    phylum_name: 'Arthropoda',
    class_name: 'Insecta',
    order_name: 'Ephemeroptera',
    family_name: 'Baetidae',
    genus_name: 'Baetis',
    species_name: 'Baetis rhodani',
    marker_sequence: 'TTTTTATTTTATTTTTGGAGCATGAGCAGGAATAGTAGGTACATCATTAAGTTTATTAATTCGTGCTGAATTAGGACATCCAGGATCTTTAATTGGTGATGATCAAATTTATAATGTAATTGTAACTGCTCATGCTTTTGTAATAATTTTTTTTATAGTTATACCTATTATAATTGGTGGTTTTGGAAATTGATTAGTACCTTTAATATTAGGAGCTCCTGATATAGCTTTTCCACGA',
  },
  {
    scientific_name: 'Polystichum munitum',
    common_name: 'Western Sword Fern',
    taxonomic_id: '32110',
    taxonomic_rank: 'species',
    domain_name: 'Eukaryota',
    kingdom_name: 'Plantae',
    phylum_name: 'Polypodiophyta',
    class_name: 'Polypodiopsida',
    order_name: 'Polypodiales',
    family_name: 'Dryopteridaceae',
    genus_name: 'Polystichum',
    species_name: 'Polystichum munitum',
    marker_sequence: 'ATGTCACCACAAACAGAGACTAAAGCAAGTGTTGGATTCAAAGCTGGTGTTAAAGATTATAAATTGACTTATTATACTCCTGAATATGAAACCAAAGATACTGATATCTTGGCAGCATTCCGAGTAACTCCTCAACCTGGAGTTCCACCTGAAGAAGCAGGGGCTGCGGTAGCTGCCGAATCTTCTACTGGTACATGGACAACTGTGTGGACCGATGGACTTACCAGTCTTGATCGT',
  },
  {
    scientific_name: 'Lutra canadensis',
    common_name: 'North American River Otter',
    taxonomic_id: '76717',
    taxonomic_rank: 'species',
    domain_name: 'Eukaryota',
    kingdom_name: 'Animalia',
    phylum_name: 'Chordata',
    class_name: 'Mammalia',
    order_name: 'Carnivora',
    family_name: 'Mustelidae',
    genus_name: 'Lutra',
    species_name: 'Lutra canadensis',
    marker_sequence: 'ATGTTCATTAACCGTTGACTATTCTCAACCAACCACAAAGATATTGGAACCTTATACCTATTATTCGGTGCCTGAGCCGGAATAGTAGGAACAGCCCTAAGTCTGCTGATCCGTGCAGAATTAGGCCAACCTGGCACCCTTCTAGGCGACGATCAAATCTATAATGTAATTGTCACAGCCCATGCATTCGTAATAATTTTCTTTATAGTAATGCCTATTATAATCGGAGGCTTTGGAAAC',
  },
];

function kmerSet(seq: string, k = 6): Set<string> {
  const clean = seq.replace(/[^ATGC]/g, '');
  const set = new Set<string>();
  for (let i = 0; i <= clean.length - k; i++) {
    set.add(clean.slice(i, i + k));
  }
  return set;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export async function lookupNcbiTaxon(queryName: string): Promise<{
  taxonomic_id: string | null;
  scientific_name: string;
  common_name: string | null;
  taxonomic_rank: string;
} | null> {
  const clean = queryName.trim();
  if (!clean) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=taxonomy&term=${encodeURIComponent(
      clean
    )}&retmode=json&retmax=1`;
    const searchRes = await fetch(searchUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!searchRes.ok) return null;

    const searchData = (await searchRes.json()) as {
      esearchresult?: { idlist?: string[] };
    };
    const taxId = searchData.esearchresult?.idlist?.[0];
    if (!taxId) return null;

    const sumController = new AbortController();
    const sumTimer = setTimeout(() => sumController.abort(), 4500);
    const sumUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=taxonomy&id=${encodeURIComponent(
      taxId
    )}&retmode=json`;
    const sumRes = await fetch(sumUrl, { signal: sumController.signal });
    clearTimeout(sumTimer);
    if (!sumRes.ok) return null;

    const sumData = (await sumRes.json()) as {
      result?: Record<string, { scientificname?: string; commonname?: string; rank?: string }>;
    };
    const entry = sumData.result?.[taxId];
    if (!entry) return null;

    return {
      taxonomic_id: taxId,
      scientific_name: entry.scientificname || clean,
      common_name: entry.commonname || null,
      taxonomic_rank: entry.rank || 'species',
    };
  } catch {
    return null;
  }
}

export async function lookupBoldTaxon(queryName: string): Promise<{
  taxonomic_id: string | null;
  scientific_name: string;
  taxonomic_rank: string;
} | null> {
  const clean = queryName.trim();
  if (!clean) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const url = `https://v3.boldsystems.org/index.php/API_Public/taxon?taxon=${encodeURIComponent(
      clean
    )}&format=json`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      taxid?: number | string;
      taxon?: string;
      tax_rank?: string;
    };
    if (!data?.taxon) return null;
    return {
      taxonomic_id: data.taxid ? String(data.taxid) : null,
      scientific_name: data.taxon,
      taxonomic_rank: data.tax_rank || 'species',
    };
  } catch {
    return null;
  }
}

export async function runTaxonomicPipeline(params: {
  datasetId: string;
  firebaseUid: string;
  format: DatasetFormat;
  rawContent: string;
  referenceDatabase: string;
  enableExternalLookup: boolean;
  demonstrationMode: boolean;
}): Promise<{
  results: TaxonomicResult[];
  isDemonstration: boolean;
  notes: string;
}> {
  const { datasetId, firebaseUid, format, rawContent, referenceDatabase, enableExternalLookup, demonstrationMode } = params;
  const now = new Date().toISOString();

  // Case 1: Tabular dataset (CSV / TSV)
  if (format === 'csv' || format === 'tsv') {
    const delimiter = format === 'csv' ? ',' : '\t';
    const { preview, allRows } = parseCsvOrTsv(rawContent, delimiter);
    const cols = preview.detectedColumns;

    if (!cols.scientificName && !cols.sequence) {
      throw new Error(
        'CSV/TSV file must include either a taxonomic column (e.g., scientific_name, species, taxon) or a DNA sequence column (e.g., sequence).'
      );
    }

    const results: TaxonomicResult[] = [];
    let usedDemo = false;

    for (let idx = 0; idx < allRows.length; idx++) {
      const row = allRows[idx];
      const seqId = (cols.sequenceId ? row[cols.sequenceId] : '') || `ROW_${idx + 1}`;
      const rawReads = cols.readCount ? Number(row[cols.readCount]) : 1;
      const readCount = Number.isFinite(rawReads) && rawReads > 0 ? Math.round(rawReads) : 1;
      const rawSim = cols.similarity ? Number(row[cols.similarity]) : NaN;

      if (cols.scientificName && row[cols.scientificName]?.trim()) {
        const sciName = row[cols.scientificName].trim();
        let taxId: string | null = row['taxid'] || row['taxonomic_id'] || null;
        let commonName: string | null = row['common_name'] || null;
        let rank = row['taxonomic_rank'] || row['rank'] || 'species';
        let status: TaxonomicResult['identification_status'] = 'dataset_provided';

        if (enableExternalLookup && idx < 15) {
          if (referenceDatabase === 'BOLD') {
            const bold = await lookupBoldTaxon(sciName);
            if (bold) {
              taxId = bold.taxonomic_id ?? taxId;
              rank = bold.taxonomic_rank || rank;
              status = 'verified_lookup';
            }
          } else {
            const ncbi = await lookupNcbiTaxon(sciName);
            if (ncbi) {
              taxId = ncbi.taxonomic_id ?? taxId;
              commonName = ncbi.common_name ?? commonName;
              rank = ncbi.taxonomic_rank || rank;
              status = 'verified_lookup';
            }
          }
        }

        results.push({
          id: `${datasetId}_tax_${idx + 1}`,
          dataset_id: datasetId,
          firebase_uid: firebaseUid,
          sequence_id: seqId,
          scientific_name: sciName,
          common_name: commonName,
          taxonomic_rank: rank,
          taxonomic_id: taxId,
          domain_name: row['domain'] || 'Eukaryota',
          kingdom_name: row['kingdom'] || null,
          phylum_name: row['phylum'] || null,
          class_name: row['class'] || null,
          order_name: row['order'] || null,
          family_name: row['family'] || null,
          genus_name: row['genus'] || sciName.split(' ')[0] || null,
          species_name: sciName,
          reference_database: status === 'verified_lookup' ? `${referenceDatabase} (Live Lookup)` : 'Dataset Annotation',
          similarity_score: Number.isFinite(rawSim) ? Number(rawSim.toFixed(2)) : 100,
          read_count: readCount,
          identification_status: status,
          created_at: now,
        });
      } else if (cols.sequence && row[cols.sequence]?.trim()) {
        const seq = row[cols.sequence].trim().toUpperCase();
        const matched = matchSequenceAgainstDemoRef(seq);
        if (demonstrationMode && matched) {
          usedDemo = true;
          results.push({
            id: `${datasetId}_tax_${idx + 1}`,
            dataset_id: datasetId,
            firebase_uid: firebaseUid,
            sequence_id: seqId,
            scientific_name: matched.marker.scientific_name,
            common_name: matched.marker.common_name,
            taxonomic_rank: matched.marker.taxonomic_rank,
            taxonomic_id: matched.marker.taxonomic_id,
            domain_name: matched.marker.domain_name,
            kingdom_name: matched.marker.kingdom_name,
            phylum_name: matched.marker.phylum_name,
            class_name: matched.marker.class_name,
            order_name: matched.marker.order_name,
            family_name: matched.marker.family_name,
            genus_name: matched.marker.genus_name,
            species_name: matched.marker.species_name,
            reference_database: `${referenceDatabase} — Demonstration Curated Panel`,
            similarity_score: matched.score,
            read_count: readCount,
            identification_status: 'demonstration_match',
            created_at: now,
          });
        } else {
          results.push({
            id: `${datasetId}_tax_${idx + 1}`,
            dataset_id: datasetId,
            firebase_uid: firebaseUid,
            sequence_id: seqId,
            scientific_name: 'Unclassified environmental sequence',
            common_name: null,
            taxonomic_rank: 'unclassified',
            taxonomic_id: null,
            domain_name: null,
            kingdom_name: null,
            phylum_name: null,
            class_name: null,
            order_name: null,
            family_name: null,
            genus_name: null,
            species_name: null,
            reference_database: referenceDatabase,
            similarity_score: 0,
            read_count: readCount,
            identification_status: 'unclassified',
            created_at: now,
          });
        }
      }
    }

    return {
      results,
      isDemonstration: usedDemo,
      notes: usedDemo
        ? 'Sequence screening used the Demonstration Reference Panel because raw sequence rows require external BLAST alignment.'
        : 'Taxonomic records extracted directly from dataset annotations and optionally verified against NCBI Taxonomy / BOLD API.',
    };
  }

  // Case 2: FASTA / FASTQ / TXT raw nucleotide sequences
  const { sequences } = parseSequenceFile(rawContent, format);
  const results: TaxonomicResult[] = [];

  for (let idx = 0; idx < sequences.length; idx++) {
    const seqObj = sequences[idx];
    const readMatch = seqObj.header.match(/reads?[=:](\d+)/i) || seqObj.header.match(/size=(\d+)/i);
    const readCount = readMatch ? Math.max(1, Number(readMatch[1])) : 1;

    if (demonstrationMode) {
      const matched = matchSequenceAgainstDemoRef(seqObj.sequence);
      if (matched) {
        results.push({
          id: `${datasetId}_tax_${idx + 1}`,
          dataset_id: datasetId,
          firebase_uid: firebaseUid,
          sequence_id: seqObj.id,
          scientific_name: matched.marker.scientific_name,
          common_name: matched.marker.common_name,
          taxonomic_rank: matched.marker.taxonomic_rank,
          taxonomic_id: matched.marker.taxonomic_id,
          domain_name: matched.marker.domain_name,
          kingdom_name: matched.marker.kingdom_name,
          phylum_name: matched.marker.phylum_name,
          class_name: matched.marker.class_name,
          order_name: matched.marker.order_name,
          family_name: matched.marker.family_name,
          genus_name: matched.marker.genus_name,
          species_name: matched.marker.species_name,
          reference_database: `${referenceDatabase} — Demonstration Curated Panel`,
          similarity_score: matched.score,
          read_count: readCount,
          identification_status: 'demonstration_match',
          created_at: now,
        });
        continue;
      }
    }

    results.push({
      id: `${datasetId}_tax_${idx + 1}`,
      dataset_id: datasetId,
      firebase_uid: firebaseUid,
      sequence_id: seqObj.id,
      scientific_name: 'Unclassified (External BLAST Required)',
      common_name: null,
      taxonomic_rank: 'unclassified',
      taxonomic_id: null,
      domain_name: null,
      kingdom_name: null,
      phylum_name: null,
      class_name: null,
      order_name: null,
      family_name: null,
      genus_name: null,
      species_name: null,
      reference_database: referenceDatabase,
      similarity_score: 0,
      read_count: readCount,
      identification_status: 'unclassified',
      created_at: now,
    });
  }

  return {
    results,
    isDemonstration: demonstrationMode,
    notes: demonstrationMode
      ? 'Demonstration Mode active: nucleotide sequences screened via 6-mer similarity against curated freshwater/riparian reference markers. Results are illustrative only and not confirmed wet-lab BLAST alignments.'
      : 'Raw nucleotide sequences parsed and validated. External BLAST alignment required for species assignment.',
  };
}

function matchSequenceAgainstDemoRef(seq: string): { marker: ReferenceMarker; score: number } | null {
  const queryKmers = kmerSet(seq, 6);
  let best: ReferenceMarker | null = null;
  let bestScore = 0;

  for (const marker of DEMO_REFERENCE_MARKERS) {
    const refKmers = kmerSet(marker.marker_sequence, 6);
    const sim = jaccardSimilarity(queryKmers, refKmers);
    if (sim > bestScore) {
      bestScore = sim;
      best = marker;
    }
  }

  if (!best || bestScore < 0.12) return null;
  // Convert Jaccard 6-mer overlap to an approximate percentage similarity (capped cleanly)
  const pctScore = Number(Math.min(99.6, Math.max(72.0, 68 + bestScore * 32)).toFixed(2));
  return { marker: best, score: pctScore };
}

export function getSampleDatasets(): Record<
  string,
  { name: string; filename: string; format: DatasetFormat; sampleId: string; location: string; sampleType: string; description: string; content: string }
> {
  return {
    freshwater_fasta: {
      name: 'Cascade Creek Freshwater eDNA (Demonstration FASTA)',
      filename: 'cascade_creek_demo.fasta',
      format: 'fasta',
      sampleId: 'DEMO-CC-01',
      location: 'Cascade Headwater Stream, Oregon (44.3°N)',
      sampleType: 'Freshwater Filter (0.45 µm)',
      description: 'Curated demonstration COI/rbcL eDNA sequences for evaluating taxonomic screening and diversity indices.',
      content: [
        '>SEQ_001_COI_STREAM reads=142',
        'CACTCTTTATCTTGTATTTGGTGCCTGAGCCGGTATAGTAGGAACAGCCCTAAGCCTACTAATTCGAGCAGAACTGAGCCAACCCGGCGCCCTTCTTGGAGACGACCAGATCTATAATGTCATCGTTACAGCCCATGCCTTCGTAATAATTTTCTTTATAGTAATACCAATTATAATCGGAGGCTTTGGAAACTGACTCATTCCACTAATGATTGGAGCCCCAGACATGGCATTCCCACGA',
        '>SEQ_002_COI_CANOPY reads=86',
        'GGAACCCTCTACCTCGTATTCGGCGCATGAGCTGGGATAGTAGGAACTGCCCTTAGCCTATTAATTCGTGCAGAGTTAGGTCAACCTGGTGCCCTTCTAGGAGATGATCAAATTTACAATGTAGTCGTAACAGCTCATGCCTTCGTAATGATTTTCTTTATAGTTATACCTATTATAATTGGTGGCTTTGGAAACTGACTAGTCCCTTTAATAATCGGGGCCCCTGATATAGCATTTCCACGT',
        '>SEQ_003_COI_POOL reads=118',
        'ACACTGTATCTTGTCTTCGGCGCCTGAGCCGGAATAGTCGGCACCGCCTTAAGTCTCTTAATCCGGGCAGAACTAAGCCAACCTGGGGCTCTACTGGGGGACGACCAAATTTATAACGTAATCGTTACTGCCCATGCTTTCGTTATGATTTTCTTCATAGTAATGCCAATTATGATTGGGGGGTTCGGAAACTGATTAATCCCCTTGATGATCGGAGCCCCAGACATAGCATTCCCACGA',
        '>SEQ_004_COI_RIFFLE reads=64',
        'TTTTTATTTTATTTTTGGAGCATGAGCAGGAATAGTAGGTACATCATTAAGTTTATTAATTCGTGCTGAATTAGGACATCCAGGATCTTTAATTGGTGATGATCAAATTTATAATGTAATTGTAACTGCTCATGCTTTTGTAATAATTTTTTTTATAGTTATACCTATTATAATTGGTGGTTTTGGAAATTGATTAGTACCTTTAATATTAGGAGCTCCTGATATAGCTTTTCCACGA',
        '>SEQ_005_RBCL_BANK reads=49',
        'ATGTCACCACAAACAGAGACTAAAGCAAGTGTTGGATTCAAAGCTGGTGTTAAAGATTATAAATTGACTTATTATACTCCTGAATATGAAACCAAAGATACTGATATCTTGGCAGCATTCCGAGTAACTCCTCAACCTGGAGTTCCACCTGAAGAAGCAGGGGCTGCGGTAGCTGCCGAATCTTCTACTGGTACATGGACAACTGTGTGGACCGATGGACTTACCAGTCTTGATCGT',
        '>SEQ_006_COI_BANK reads=23',
        'ATGTTCATTAACCGTTGACTATTCTCAACCAACCACAAAGATATTGGAACCTTATACCTATTATTCGGTGCCTGAGCCGGAATAGTAGGAACAGCCCTAAGTCTGCTGATCCGTGCAGAATTAGGCCAACCTGGCACCCTTCTAGGCGACGATCAAATCTATAATGTAATTGTCACAGCCCATGCATTCGTAATAATTTTCTTTATAGTAATGCCTATTATAATCGGAGGCTTTGGAAAC',
      ].join('\n'),
    },
    estuary_csv: {
      name: 'Puget Estuary Metabarcoding ASV Table (Demonstration CSV)',
      filename: 'puget_estuary_demo.csv',
      format: 'csv',
      sampleId: 'DEMO-PE-04',
      location: 'Nisqually Delta Estuary, Washington',
      sampleType: 'Brackish Water Column',
      description: 'Demonstration ASV taxonomic abundance matrix compatible with live NCBI Taxonomy verification and diversity comparison.',
      content: [
        'sequence_id,scientific_name,common_name,phylum,class,order,family,read_count,similarity',
        'ASV_01,Oncorhynchus tshawytscha,Chinook Salmon,Chordata,Actinopterygii,Salmoniformes,Salmonidae,312,99.4',
        'ASV_02,Clupea pallasii,Pacific Herring,Chordata,Actinopterygii,Clupeiformes,Clupeidae,248,98.9',
        'ASV_03,Metacarcinus magister,Dungeness Crab,Arthropoda,Malacostraca,Decapoda,Cancridae,134,99.1',
        'ASV_04,Zostera marina,Common Eelgrass,Tracheophyta,Liliopsida,Alismatales,Zosteraceae,187,99.8',
        'ASV_05,Phoca vitulina,Harbor Seal,Chordata,Mammalia,Carnivora,Phocidae,41,98.6',
        'ASV_06,Mytilus trossulus,Pacific Blue Mussel,Mollusca,Bivalvia,Mytilida,Mytilidae,96,97.8',
      ].join('\n'),
    },
  };
}
