-- eDNA Explorer — Supabase PostgreSQL Schema
-- Run this script in the Supabase SQL Editor before deploying.

create extension if not exists "pgcrypto";

-- 1. datasets
create table if not exists public.datasets (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null,
  project_id text,
  dataset_name text not null,
  sample_id text not null,
  file_path text not null,
  file_format text not null check (file_format in ('csv', 'tsv', 'fasta', 'fastq', 'txt')),
  file_size_bytes bigint not null default 0,
  sample_location text not null,
  collection_date date not null,
  sample_type text not null,
  organism_group text,
  description text,
  status text not null default 'uploaded' check (status in ('uploaded', 'validated', 'processing', 'analyzed', 'failed')),
  preview_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_datasets_firebase_uid on public.datasets (firebase_uid);
create index if not exists idx_datasets_status on public.datasets (status);
create index if not exists idx_datasets_created_at on public.datasets (created_at desc);

-- 2. samples
create table if not exists public.samples (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  firebase_uid text not null,
  sample_code text not null,
  sample_location text not null,
  collection_date date not null,
  sample_type text not null,
  latitude double precision,
  longitude double precision,
  water_temp_c double precision,
  ph double precision,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_samples_dataset_id on public.samples (dataset_id);
create index if not exists idx_samples_firebase_uid on public.samples (firebase_uid);

-- 3. sequences
create table if not exists public.sequences (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  sample_id uuid references public.samples(id) on delete set null,
  firebase_uid text not null,
  sequence_identifier text not null,
  raw_sequence text not null,
  sequence_length integer not null,
  gc_content numeric(5, 2),
  read_count integer not null default 1,
  mean_quality numeric(5, 2),
  created_at timestamptz not null default now()
);

create index if not exists idx_sequences_dataset_id on public.sequences (dataset_id);
create index if not exists idx_sequences_firebase_uid on public.sequences (firebase_uid);

-- 4. taxonomic_results
create table if not exists public.taxonomic_results (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  firebase_uid text not null,
  sequence_id text not null,
  scientific_name text not null,
  common_name text,
  taxonomic_rank text not null,
  taxonomic_id text,
  domain_name text,
  kingdom_name text,
  phylum_name text,
  class_name text,
  order_name text,
  family_name text,
  genus_name text,
  species_name text,
  reference_database text not null,
  similarity_score numeric(5, 2) not null,
  read_count integer not null default 1,
  identification_status text not null check (identification_status in ('verified_lookup', 'dataset_provided', 'demonstration_match', 'unclassified')),
  created_at timestamptz not null default now()
);

create index if not exists idx_taxonomic_results_dataset_id on public.taxonomic_results (dataset_id);
create index if not exists idx_taxonomic_results_firebase_uid on public.taxonomic_results (firebase_uid);
create index if not exists idx_taxonomic_results_scientific_name on public.taxonomic_results (scientific_name);

-- 5. biodiversity_metrics
create table if not exists public.biodiversity_metrics (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  sample_id uuid references public.samples(id) on delete set null,
  firebase_uid text not null,
  species_richness integer not null default 0,
  total_reads integer not null default 0,
  shannon_index numeric(8, 4) not null default 0,
  simpson_index numeric(8, 4) not null default 0,
  simpson_diversity numeric(8, 4) not null default 0,
  pielou_evenness numeric(8, 4),
  relative_abundances jsonb not null default '[]'::jsonb,
  is_demonstration boolean not null default false,
  calculated_at timestamptz not null default now()
);

create index if not exists idx_biodiversity_metrics_dataset_id on public.biodiversity_metrics (dataset_id);
create index if not exists idx_biodiversity_metrics_firebase_uid on public.biodiversity_metrics (firebase_uid);

-- 6. analysis_jobs
create table if not exists public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  firebase_uid text not null,
  job_type text not null check (job_type in ('taxonomic_identification', 'biodiversity_assessment', 'full_pipeline')),
  reference_database text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  is_demonstration boolean not null default false,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_analysis_jobs_dataset_id on public.analysis_jobs (dataset_id);
create index if not exists idx_analysis_jobs_firebase_uid on public.analysis_jobs (firebase_uid);

-- 7. reports
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  firebase_uid text not null,
  report_title text not null,
  ai_summary text,
  methodology_notes text not null,
  limitations_notes text not null,
  generated_at timestamptz not null default now()
);

create index if not exists idx_reports_dataset_id on public.reports (dataset_id);
create index if not exists idx_reports_firebase_uid on public.reports (firebase_uid);

-- Storage Bucket for large eDNA dataset files (private bucket)
insert into storage.buckets (id, name, public)
values ('edna-datasets', 'edna-datasets', false)
on conflict (id) do nothing;
