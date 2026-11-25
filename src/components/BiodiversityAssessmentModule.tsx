import React, { useMemo, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BiodiversityMetrics, DatasetRecord, TaxonomicResult } from '../types';
import { AiAssistantPanel } from './AiAssistantPanel';

interface BiodiversityAssessmentModuleProps {
  datasets: DatasetRecord[];
  allMetrics: BiodiversityMetrics[];
  allTaxonomicResults: TaxonomicResult[];
  selectedDatasetId: string | null;
  onSelectDataset: (id: string) => void;
}

const CHART_COLORS = ['#087A50', '#55D6C2', '#063B2B', '#9BE564', '#2C8C99', '#3FA34D', '#76C893', '#184E77'];

export function BiodiversityAssessmentModule({
  datasets,
  allMetrics,
  allTaxonomicResults,
  selectedDatasetId,
  onSelectDataset,
}: BiodiversityAssessmentModuleProps) {
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const analyzedDatasets = datasets.filter((d) =>
    allMetrics.some((m) => m.dataset_id === d.id)
  );
  const activeDataset =
    datasets.find((d) => d.id === selectedDatasetId) || analyzedDatasets[0] || datasets[0] || null;

  const activeMetric = activeDataset
    ? allMetrics.find((m) => m.dataset_id === activeDataset.id) || null
    : null;

  const activeTaxa = useMemo(() => {
    if (!activeDataset) return [];
    return allTaxonomicResults.filter((t) => t.dataset_id === activeDataset.id);
  }, [activeDataset, allTaxonomicResults]);

  const phylumDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    activeTaxa.forEach((t) => {
      if (t.identification_status === 'unclassified') return;
      const key = t.phylum_name || 'Other / Unassigned Phylum';
      counts.set(key, (counts.get(key) || 0) + t.read_count);
    });
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [activeTaxa]);

  const speciesBars = useMemo(() => {
    if (!activeMetric) return [];
    return activeMetric.relative_abundances.slice(0, 12).map((entry) => ({
      name: entry.scientific_name,
      percentage: entry.percentage,
      reads: entry.read_count,
    }));
  }, [activeMetric]);

  const comparisonData = useMemo(() => {
    const targetIds =
      compareIds.length > 0 ? compareIds : allMetrics.slice(0, 5).map((m) => m.dataset_id);
    return allMetrics
      .filter((m) => targetIds.includes(m.dataset_id))
      .map((m) => {
        const ds = datasets.find((d) => d.id === m.dataset_id);
        return {
          sample: ds ? `${ds.sample_id} (${ds.sample_location.split(',')[0]})` : m.dataset_id.slice(0, 8),
          shannon: Number(m.shannon_index),
          simpsonDiv: Number(m.simpson_diversity),
          evenness: m.pielou_evenness !== null ? Number(m.pielou_evenness) : 0,
          richness: m.species_richness,
        };
      });
  }, [allMetrics, compareIds, datasets]);

  const toggleCompare = (datasetId: string) => {
    setCompareIds((prev) =>
      prev.includes(datasetId) ? prev.filter((id) => id !== datasetId) : [...prev, datasetId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Dataset Selector + Ecological Caveat */}
      <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-[#063B2B] dark:text-white">
              Biodiversity Metrics &amp; Community Structure
            </h3>
            <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6] mt-0.5">
              Select a dataset to evaluate Species Richness, Shannon H&apos;, Simpson D, and Pielou&apos;s Evenness.
            </p>
          </div>
          <select
            value={activeDataset?.id || ''}
            onChange={(e) => onSelectDataset(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm min-w-[240px]"
          >
            {datasets.length === 0 ? (
              <option value="">No datasets available</option>
            ) : (
              datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.dataset_name} ({d.status})
                </option>
              ))
            )}
          </select>
        </div>

        <div className="rounded-lg border border-sky-500/30 bg-sky-50 dark:bg-sky-950/30 p-3.5 text-xs text-sky-900 dark:text-sky-200 flex items-start gap-2.5">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Methodological Note:</strong> eDNA sequence read counts represent amplified DNA fragment frequencies and are <strong>not automatically equivalent to organism abundance or biomass</strong> due to PCR primer efficiency, species-specific DNA shedding rates, and environmental degradation.
          </span>
        </div>

        {activeMetric?.is_demonstration && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Demonstration Mode Data:</strong> These indices were computed from demonstration taxonomic assignments and should not be reported as confirmed ecological survey evidence.
            </span>
          </div>
        )}
      </div>

      {!activeMetric ? (
        <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-12 text-center text-sm text-[#4B6F61] dark:text-[#8FB7A6]">
          No calculated biodiversity metrics exist for this dataset yet. Run Taxonomic Identification first.
        </div>
      ) : (
        <>
          {/* 4 Scientific Index Cards + Formulas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
              <p className="text-xs font-medium text-[#4B6F61] dark:text-[#8FB7A6]">Species Richness (S)</p>
              <p className="mt-2 text-3xl font-mono font-bold text-[#063B2B] dark:text-white tabular-nums">
                {activeMetric.species_richness}
              </p>
              <p className="mt-1 text-[11px] font-mono text-[#4B6F61] dark:text-[#8FB7A6]">
                Total Reads (N): {activeMetric.total_reads.toLocaleString()}
              </p>
            </div>

            <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
              <p className="text-xs font-medium text-[#4B6F61] dark:text-[#8FB7A6]">Shannon Diversity (H&apos;)</p>
              <p className="mt-2 text-3xl font-mono font-bold text-[#087A50] dark:text-[#55D6C2] tabular-nums">
                {Number(activeMetric.shannon_index).toFixed(4)}
              </p>
              <p className="mt-1 text-[11px] font-mono text-[#4B6F61] dark:text-[#8FB7A6]">
                H&apos; = -Σ(pi × ln(pi))
              </p>
            </div>

            <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
              <p className="text-xs font-medium text-[#4B6F61] dark:text-[#8FB7A6]">Simpson Index (D / 1-D)</p>
              <p className="mt-2 text-3xl font-mono font-bold text-[#063B2B] dark:text-white tabular-nums">
                {Number(activeMetric.simpson_diversity).toFixed(4)}
              </p>
              <p className="mt-1 text-[11px] font-mono text-[#4B6F61] dark:text-[#8FB7A6]">
                D = Σ(pi²) = {Number(activeMetric.simpson_index).toFixed(4)}
              </p>
            </div>

            <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
              <p className="text-xs font-medium text-[#4B6F61] dark:text-[#8FB7A6]">Pielou&apos;s Evenness (J)</p>
              <p className="mt-2 text-3xl font-mono font-bold text-[#063B2B] dark:text-white tabular-nums">
                {activeMetric.pielou_evenness !== null
                  ? Number(activeMetric.pielou_evenness).toFixed(4)
                  : 'N/A'}
              </p>
              <p className="mt-1 text-[11px] font-mono text-[#4B6F61] dark:text-[#8FB7A6]">
                {activeMetric.species_richness <= 1 ? 'Requires S > 1' : "J = H' / ln(S)"}
              </p>
            </div>
          </div>

          {/* Charts Grid: Relative Abundance Bar + Taxonomic Composition Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
              <h4 className="text-sm font-semibold text-[#063B2B] dark:text-white mb-4">
                Relative Read Abundance by Species (%)
              </h4>
              {speciesBars.length === 0 ? (
                <p className="py-12 text-center text-xs text-[#4B6F61]">No classified species abundance data.</p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={speciesBars}
                      layout="vertical"
                      margin={{ top: 4, right: 20, left: 20, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#D8E5DD" opacity={0.4} />
                      <XAxis type="number" unit="%" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={145}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip />
                      <Bar dataKey="percentage" name="Relative Abundance (%)" fill="#087A50" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
              <h4 className="text-sm font-semibold text-[#063B2B] dark:text-white mb-4">
                Taxonomic Composition (by Phylum)
              </h4>
              {phylumDistribution.length === 0 ? (
                <p className="py-12 text-center text-xs text-[#4B6F61]">No phylum annotations available.</p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={phylumDistribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="46%"
                        innerRadius={52}
                        outerRadius={84}
                        paddingAngle={2}
                      >
                        {phylumDistribution.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Multi-Sample Comparison */}
          {allMetrics.length > 1 && (
            <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-[#063B2B] dark:text-white">
                    Cross-Sample Diversity Comparison
                  </h4>
                  <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6]">
                    Compare Shannon, Simpson Diversity, and Evenness across sampling locations
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analyzedDatasets.map((ds) => {
                    const selected = compareIds.length === 0 || compareIds.includes(ds.id);
                    return (
                      <button
                        key={ds.id}
                        type="button"
                        onClick={() => toggleCompare(ds.id)}
                        className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                          selected
                            ? 'bg-[#087A50] text-white border-[#087A50]'
                            : 'border-[#C5D8CD] dark:border-[#1D4D3E] text-[#355E4F] dark:text-[#B9D8CA]'
                        }`}
                      >
                        {ds.sample_id}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D8E5DD" opacity={0.4} />
                    <XAxis dataKey="sample" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="shannon" name="Shannon (H')" fill="#087A50" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="simpsonDiv" name="Simpson (1-D)" fill="#55D6C2" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="evenness" name="Evenness (J)" fill="#9BE564" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Relative Abundance Table */}
          <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#D8E5DD] dark:border-[#143A2F]">
              <h4 className="text-sm font-semibold text-[#063B2B] dark:text-white">
                Relative Abundance Breakdown (pi = ni / N)
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F4F8F5] dark:bg-[#071D17] font-mono">
                  <tr>
                    <th className="px-4 py-2.5">Scientific Name</th>
                    <th className="px-4 py-2.5">Common Name</th>
                    <th className="px-4 py-2.5 text-right">Read Count (ni)</th>
                    <th className="px-4 py-2.5 text-right">Proportion (pi)</th>
                    <th className="px-4 py-2.5 text-right">Relative %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EFEA] dark:divide-[#143A2F]">
                  {activeMetric.relative_abundances.map((row) => (
                    <tr key={row.scientific_name} className="hover:bg-[#F9FCFA] dark:hover:bg-[#0F3127]">
                      <td className="px-4 py-2.5 italic font-medium">{row.scientific_name}</td>
                      <td className="px-4 py-2.5 text-[#4B6F61] dark:text-[#8FB7A6]">
                        {row.common_name || '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-right tabular-nums">{row.read_count}</td>
                      <td className="px-4 py-2.5 font-mono text-right tabular-nums">
                        {row.relative_abundance.toFixed(4)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-right tabular-nums">
                        {row.percentage.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Embedded AI Scientific Assistant */}
          <AiAssistantPanel dataset={activeDataset} />
        </>
      )}
    </div>
  );
}
