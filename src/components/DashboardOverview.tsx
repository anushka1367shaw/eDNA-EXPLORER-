import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Clock,
  Database,
  FileText,
  Loader2,
  Microscope,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import type {
  AnalysisJob,
  BackendStatus,
  BiodiversityMetrics,
  DatasetRecord,
  Project,
  TaxonomicResult,
} from '../types';
import type { WorkspaceTab } from './DashboardShell';

interface DashboardOverviewProps {
  datasets: DatasetRecord[];
  jobs: AnalysisJob[];
  metrics: BiodiversityMetrics[];
  taxonomicResults: TaxonomicResult[];
  projects: Project[];
  backendStatus: BackendStatus | null;
  loadingData: boolean;
  onNavigateTab: (tab: WorkspaceTab) => void;
  onSelectDataset: (id: string) => void;
}

export function DashboardOverview({
  datasets,
  jobs,
  metrics,
  taxonomicResults,
  projects,
  backendStatus,
  loadingData,
  onNavigateTab,
  onSelectDataset,
}: DashboardOverviewProps) {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  const uniqueSpecies = new Set(
    taxonomicResults
      .filter((t) => t.identification_status !== 'unclassified')
      .map((t) => t.scientific_name)
  ).size;

  const latestMetric = metrics[0] || null;
  const chartData = metrics.slice(0, 6).map((m) => {
    const ds = datasets.find((d) => d.id === m.dataset_id);
    return {
      name: ds ? ds.sample_id : m.dataset_id.slice(0, 8),
      richness: m.species_richness,
      shannon: Number(m.shannon_index),
    };
  });

  const handleGenerateInsight = async () => {
    if (!datasets[0]) {
      notify('No datasets yet', 'Upload or load a sample dataset first to generate insights.', 'info');
      return;
    }
    setLoadingInsight(true);
    try {
      const targetDataset =
        datasets.find((d) => d.id === latestMetric?.dataset_id) || datasets[0];
      const res = await apiFetch<{ answer: string }>('/api/ai/interpret', {
        method: 'POST',
        body: JSON.stringify({
          datasetId: targetDataset.id,
          question:
            'Provide a concise 3-bullet scientific summary of the observed taxonomic composition and biodiversity indices for this dataset, separating direct observations from cautious ecological interpretation.',
        }),
      });
      setAiSummary(res.answer);
    } catch (err) {
      notify('AI summary unavailable', err instanceof Error ? err.message : 'Unable to reach Gemini.', 'error');
    } finally {
      setLoadingInsight(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#063B2B] dark:text-white">
            Welcome back, {profile?.fullName || 'Researcher'}!
          </h2>
          <p className="mt-1 text-sm text-[#355E4F] dark:text-[#B9D8CA]">
            {profile?.institution ? `${profile.institution} · ` : ''}
            Environmental DNA sequencing, taxonomic verification, and biodiversity workspace
          </p>
        </div>

        {backendStatus && !backendStatus.supabaseConfigured && (
          <button
            type="button"
            onClick={() => onNavigateTab('settings')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-xs font-medium text-amber-800 dark:text-amber-300 text-left"
          >
            <Database className="w-4 h-4 shrink-0" />
            <span>Local Research Sandbox active · Connect Supabase in Settings</span>
          </button>
        )}
      </div>

      {/* 4 Core KPI Statistics */}
      {loadingData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
            <p className="text-xs font-medium text-[#4B6F61] dark:text-[#8FB7A6]">Total Datasets Uploaded</p>
            <p className="mt-2 text-3xl font-mono font-bold text-[#063B2B] dark:text-white tabular-nums">
              {datasets.length}
            </p>
          </div>
          <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
            <p className="text-xs font-medium text-[#4B6F61] dark:text-[#8FB7A6]">Total Analyses</p>
            <p className="mt-2 text-3xl font-mono font-bold text-[#063B2B] dark:text-white tabular-nums">
              {jobs.length}
            </p>
          </div>
          <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
            <p className="text-xs font-medium text-[#4B6F61] dark:text-[#8FB7A6]">Species Identified</p>
            <p className="mt-2 text-3xl font-mono font-bold text-[#087A50] dark:text-[#55D6C2] tabular-nums">
              {uniqueSpecies}
            </p>
          </div>
          <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
            <p className="text-xs font-medium text-[#4B6F61] dark:text-[#8FB7A6]">Research Projects</p>
            <p className="mt-2 text-3xl font-mono font-bold text-[#063B2B] dark:text-white tabular-nums">
              {projects.length}
            </p>
          </div>
        </div>
      )}

      {/* A. Quick Actions */}
      <section>
        <h3 className="text-base font-semibold text-[#063B2B] dark:text-white mb-3">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => onNavigateTab('upload')}
            className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-4 text-left hover:border-[#087A50] transition-colors flex items-center justify-between gap-3"
          >
            <div>
              <p className="text-sm font-semibold text-[#063B2B] dark:text-white">Upload New Dataset</p>
              <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6] mt-0.5">CSV, TSV, FASTA, FASTQ</p>
            </div>
            <Upload className="w-5 h-5 text-[#087A50] dark:text-[#55D6C2] shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('taxonomy')}
            className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-4 text-left hover:border-[#087A50] transition-colors flex items-center justify-between gap-3"
          >
            <div>
              <p className="text-sm font-semibold text-[#063B2B] dark:text-white">Start New Analysis</p>
              <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6] mt-0.5">Taxonomic classification</p>
            </div>
            <Microscope className="w-5 h-5 text-[#087A50] dark:text-[#55D6C2] shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('reports')}
            className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-4 text-left hover:border-[#087A50] transition-colors flex items-center justify-between gap-3"
          >
            <div>
              <p className="text-sm font-semibold text-[#063B2B] dark:text-white">View Previous Reports</p>
              <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6] mt-0.5">PDF &amp; CSV exports</p>
            </div>
            <FileText className="w-5 h-5 text-[#087A50] dark:text-[#55D6C2] shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('biodiversity')}
            className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-4 text-left hover:border-[#087A50] transition-colors flex items-center justify-between gap-3"
          >
            <div>
              <p className="text-sm font-semibold text-[#063B2B] dark:text-white">Explore Biodiversity</p>
              <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6] mt-0.5">Shannon, Simpson, Pielou</p>
            </div>
            <BarChart3 className="w-5 h-5 text-[#087A50] dark:text-[#55D6C2] shrink-0" />
          </button>
        </div>
      </section>

      {/* B & C: Recent Activity + Biodiversity Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#063B2B] dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#087A50] dark:text-[#55D6C2]" />
              Recent Activity
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('history')}
              className="text-xs font-medium text-[#087A50] dark:text-[#55D6C2] hover:underline"
            >
              View History
            </button>
          </div>

          {datasets.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-[#4B6F61] dark:text-[#8FB7A6]">
                No datasets uploaded yet. Upload a sequencing file or load a demonstration sample to begin.
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('upload')}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#087A50] text-white text-xs font-medium hover:bg-[#063B2B]"
              >
                Upload Dataset
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#E7EFEA] dark:divide-[#143A2F]">
              {datasets.slice(0, 5).map((ds) => (
                <div key={ds.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectDataset(ds.id);
                        onNavigateTab(ds.status === 'analyzed' ? 'biodiversity' : 'taxonomy');
                      }}
                      className="text-sm font-medium text-[#063B2B] dark:text-white hover:text-[#087A50] truncate block text-left"
                    >
                      {ds.dataset_name}
                    </button>
                    <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6] mt-0.5">
                      {ds.sample_id} · {ds.file_format.toUpperCase()} · {ds.sample_location}
                    </p>
                  </div>
                  <span className="font-mono text-xs shrink-0 text-[#087A50] dark:text-[#55D6C2]">
                    {ds.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* C. Biodiversity Overview */}
        <div className="lg:col-span-6 rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#063B2B] dark:text-white">
              Biodiversity Overview
            </h3>
            {latestMetric && (
              <span className="font-mono text-xs text-[#4B6F61] dark:text-[#8FB7A6]">
                Latest H&apos;: {latestMetric.shannon_index.toFixed(3)}
              </span>
            )}
          </div>

          {chartData.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#4B6F61] dark:text-[#8FB7A6]">
              Run taxonomic identification on a dataset to visualize species richness and diversity trends.
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D8E5DD" opacity={0.4} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="richness" name="Species Richness (S)" fill="#087A50" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="shannon" name="Shannon Index (H')" fill="#55D6C2" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* D. Research Insights (AI-Generated Summary grounded in actual data) */}
      <section className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[#063B2B] dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#087A50] dark:text-[#55D6C2]" />
              Research Insights
            </h3>
            <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6] mt-0.5">
              AI-generated interpretation strictly referencing your latest computed dataset metrics
            </p>
          </div>
          <button
            type="button"
            disabled={loadingInsight || datasets.length === 0}
            onClick={() => void handleGenerateInsight()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087A50] text-white text-xs font-medium hover:bg-[#063B2B] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            {loadingInsight && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Generate Summary from Latest Data
          </button>
        </div>

        {aiSummary ? (
          <div className="mt-4 pt-4 border-t border-[#E7EFEA] dark:border-[#143A2F] text-sm text-[#1E4D3D] dark:text-[#D5EAE0] whitespace-pre-wrap leading-relaxed">
            {aiSummary}
          </div>
        ) : (
          <p className="mt-4 text-xs text-[#4B6F61] dark:text-[#8FB7A6]">
            Click &ldquo;Generate Summary from Latest Data&rdquo; after running an analysis to inspect observations, caveats, and suggested follow-up sampling.
          </p>
        )}
      </section>
    </div>
  );
}
