-- eDNA Explorer — Supabase Row Level Security (RLS) Policies
-- Firebase UIDs are linked via backend service-role authorization or JWT sub claims.

alter table public.datasets enable row level security;
alter table public.samples enable row level security;
alter table public.sequences enable row level security;
alter table public.taxonomic_results enable row level security;
alter table public.biodiversity_metrics enable row level security;
alter table public.analysis_jobs enable row level security;
alter table public.reports enable row level security;

-- Helper expression if using custom-minted Supabase JWTs with Firebase UID in `sub`
-- and `role = 'admin'` claim; service_role automatically bypasses RLS for trusted backend calls.

create policy "Users can view own datasets"
  on public.datasets for select
  using (firebase_uid = auth.jwt()->>'sub' or (auth.jwt()->>'app_role') = 'admin');

create policy "Users can insert own datasets"
  on public.datasets for insert
  with check (firebase_uid = auth.jwt()->>'sub');

create policy "Users can update own datasets"
  on public.datasets for update
  using (firebase_uid = auth.jwt()->>'sub' or (auth.jwt()->>'app_role') = 'admin');

create policy "Users or admins can delete datasets"
  on public.datasets for delete
  using (firebase_uid = auth.jwt()->>'sub' or (auth.jwt()->>'app_role') = 'admin');

-- Samples
create policy "Users can access own samples"
  on public.samples for all
  using (firebase_uid = auth.jwt()->>'sub' or (auth.jwt()->>'app_role') = 'admin')
  with check (firebase_uid = auth.jwt()->>'sub');

-- Sequences
create policy "Users can access own sequences"
  on public.sequences for all
  using (firebase_uid = auth.jwt()->>'sub' or (auth.jwt()->>'app_role') = 'admin')
  with check (firebase_uid = auth.jwt()->>'sub');

-- Taxonomic Results
create policy "Users can access own taxonomic results"
  on public.taxonomic_results for all
  using (firebase_uid = auth.jwt()->>'sub' or (auth.jwt()->>'app_role') = 'admin')
  with check (firebase_uid = auth.jwt()->>'sub');

-- Biodiversity Metrics
create policy "Users can access own biodiversity metrics"
  on public.biodiversity_metrics for all
  using (firebase_uid = auth.jwt()->>'sub' or (auth.jwt()->>'app_role') = 'admin')
  with check (firebase_uid = auth.jwt()->>'sub');

-- Analysis Jobs
create policy "Users can access own analysis jobs"
  on public.analysis_jobs for all
  using (firebase_uid = auth.jwt()->>'sub' or (auth.jwt()->>'app_role') = 'admin')
  with check (firebase_uid = auth.jwt()->>'sub');

-- Reports
create policy "Users can access own reports"
  on public.reports for all
  using (firebase_uid = auth.jwt()->>'sub' or (auth.jwt()->>'app_role') = 'admin')
  with check (firebase_uid = auth.jwt()->>'sub');
