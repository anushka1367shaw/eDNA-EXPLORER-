export type UserRole = 'user' | 'admin';
export type AccountStatus = 'active' | 'suspended';
export type ThemeMode = 'light' | 'dark' | 'system';
export type ReferenceDb = 'NCBI_NT' | 'BOLD' | 'SILVA';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  institution?: string;
  researchInterest?: string;
  role: UserRole;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  photoUrl?: string;
  createdAt: unknown;
  lastLogin: unknown;
}

export interface UserPreference {
  uid: string;
  theme: ThemeMode;
  emailNotifications: boolean;
  analysisAlerts: boolean;
  defaultReferenceDb: ReferenceDb;
  updatedAt: unknown;
}

export interface Project {
  id: string;
  ownerUid: string;
  projectName: string;
  description?: string;
  biome?: string;
  location?: string;
  status: 'active' | 'archived';
  createdAt: unknown;
  updatedAt: unknown;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  read: boolean;
  createdAt: unknown;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  active: boolean;
  createdBy: string;
  createdAt: unknown;
}

export interface AdminAuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  targetId: string;
  details: string;
  createdAt: unknown;
}

export type DatasetFormat = 'csv' | 'tsv' | 'fasta' | 'fastq' | 'txt';
export type DatasetStatus = 'uploaded' | 'validated' | 'processing' | 'analyzed' | 'failed';

export interface CsvPreview {
  kind: 'tabular';
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  detectedColumns: {
    sequenceId?: string;
    sequence?: string;
    scientificName?: string;
    readCount?: string;
    similarity?: string;
  };
}

export interface SequencePreview {
  kind: 'sequence';
  format: 'fasta' | 'fastq' | 'txt';
  sequenceCount: number;
  totalBases: number;
  minLength: number;
  maxLength: number;
  meanLength: number;
  gcContentPct: number;
  ambiguousBasePct: number;
  meanQualityScore: number | null;
  sampleSequences: Array<{
    id: string;
    header: string;
    length: number;
    gcPct: number;
    preview: string;
  }>;
}

export type DatasetPreview = CsvPreview | SequencePreview;

export interface DatasetRecord {
  id: string;
  firebase_uid: string;
  project_id: string | null;
  dataset_name: string;
  sample_id: string;
  file_path: string;
  file_format: DatasetFormat;
  file_size_bytes: number;
  sample_location: string;
  collection_date: string;
  sample_type: string;
  organism_group: string | null;
  description: string | null;
  status: DatasetStatus;
  preview_summary: DatasetPreview | null;
  created_at: string;
  updated_at: string;
}

export interface TaxonomicResult {
  id: string;
  dataset_id: string;
  firebase_uid: string;
  sequence_id: string;
  scientific_name: string;
  common_name: string | null;
  taxonomic_rank: string;
  taxonomic_id: string | null;
  domain_name: string | null;
  kingdom_name: string | null;
  phylum_name: string | null;
  class_name: string | null;
  order_name: string | null;
  family_name: string | null;
  genus_name: string | null;
  species_name: string | null;
  reference_database: string;
  similarity_score: number;
  read_count: number;
  identification_status: 'verified_lookup' | 'dataset_provided' | 'demonstration_match' | 'unclassified';
  created_at: string;
}

export interface RelativeAbundanceEntry {
  scientific_name: string;
  common_name?: string | null;
  phylum_name?: string | null;
  read_count: number;
  relative_abundance: number;
  percentage: number;
}

export interface BiodiversityMetrics {
  id: string;
  dataset_id: string;
  sample_id: string | null;
  firebase_uid: string;
  species_richness: number;
  total_reads: number;
  shannon_index: number;
  simpson_index: number;
  simpson_diversity: number;
  pielou_evenness: number | null;
  relative_abundances: RelativeAbundanceEntry[];
  is_demonstration: boolean;
  calculated_at: string;
}

export interface AnalysisJob {
  id: string;
  dataset_id: string;
  firebase_uid: string;
  job_type: 'taxonomic_identification' | 'biodiversity_assessment' | 'full_pipeline';
  reference_database: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  is_demonstration: boolean;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface ReportRecord {
  id: string;
  dataset_id: string;
  firebase_uid: string;
  report_title: string;
  ai_summary: string | null;
  methodology_notes: string;
  limitations_notes: string;
  generated_at: string;
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
  uid?: string;
}

export interface BackendStatus {
  supabaseConfigured: boolean;
  storageMode: 'supabase' | 'local_sandbox';
  geminiConfigured: boolean;
  firebaseProjectId: string;
  ncbiLookupEnabled: boolean;
}
