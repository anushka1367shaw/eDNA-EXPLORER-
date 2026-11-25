import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, Printer, Sparkles } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import type {
  BiodiversityMetrics,
  DatasetRecord,
  Project,
  ReportRecord,
  TaxonomicResult,
} from '../types';

interface ReportsModuleProps {
  datasets: DatasetRecord[];
  allMetrics: BiodiversityMetrics[];
  allTaxonomicResults: TaxonomicResult[];
  projects: Project[];
  reports: ReportRecord[];
  onReportCreated: (report: ReportRecord) => void;
}

export function ReportsModule({
  datasets,
  allMetrics,
  allTaxonomicResults,
  projects,
  reports,
  onReportCreated,
}: ReportsModuleProps) {
  const { profile } = useAuth();
  const { notify } = useToast();

  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(datasets[0]?.id || '');
  const [reportTitle, setReportTitle] = useState('');
  const [includeAiSummary, setIncludeAiSummary] = useState(true);
  const [generating, setGenerating] = useState(false);

  const activeDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0] || null;
  const activeMetric = activeDataset
    ? allMetrics.find((m) => m.dataset_id === activeDataset.id) || null
    : null;
  const activeTaxa = activeDataset
    ? allTaxonomicResults.filter((t) => t.dataset_id === activeDataset.id)
    : [];
  const activeProject = activeDataset?.project_id
    ? projects.find((p) => p.id === activeDataset.project_id) || null
    : null;

  const handleGenerateReport = async () => {
    if (!activeDataset) return;
    setGenerating(true);
    try {
      const res = await apiFetch<{ report: ReportRecord }>('/api/reports/generate', {
        method: 'POST',
        body: JSON.stringify({
          datasetId: activeDataset.id,
          reportTitle: reportTitle.trim() || `${activeDataset.dataset_name} — Biodiversity Report`,
          includeAiSummary,
        }),
      });
      onReportCreated(res.report);
      notify('Scientific report saved', 'Ready to download as PDF, export CSV, or print.', 'success');
    } catch (err) {
      notify('Report generation failed', err instanceof Error ? err.message : 'Unable to generate report.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = (report?: ReportRecord) => {
    const targetDataset = report
      ? datasets.find((d) => d.id === report.dataset_id) || activeDataset
      : activeDataset;
    if (!targetDataset) return;

    const targetMetric = allMetrics.find((m) => m.dataset_id === targetDataset.id) || null;
    const targetTaxa = allTaxonomicResults.filter((t) => t.dataset_id === targetDataset.id);
    const targetProject = targetDataset.project_id
      ? projects.find((p) => p.id === targetDataset.project_id) || null
      : null;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 48;
    const margin = 44;
    const maxWidth = 507;

    const writeWrapped = (text: string, size = 10, bold = false, color: [number, number, number] = [30, 55, 45]) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, maxWidth) as string[];
      for (const line of lines) {
        if (y > 760) {
          doc.addPage();
          y = 48;
        }
        doc.text(line, margin, y);
        y += size * 1.45;
      }
    };

    // Header
    doc.setFillColor(6, 59, 43);
    doc.rect(0, 0, 595, 76, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('eDNA Explorer — Scientific Biodiversity Report', margin, 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(155, 229, 100);
    doc.text('Discover • Identify • Conserve', margin, 54);
    y = 104;

    writeWrapped(report?.report_title || `${targetDataset.dataset_name} — Biodiversity Report`, 14, true, [6, 59, 43]);
    y += 6;
    writeWrapped(`Generated: ${new Date(report?.generated_at || Date.now()).toLocaleString()}`, 9.5);
    writeWrapped(
      `Researcher: ${profile?.fullName || 'Researcher'}${profile?.institution ? ` (${profile.institution})` : ''} · Email: ${profile?.email || ''}`,
      9.5
    );
    if (targetProject) {
      writeWrapped(`Project: ${targetProject.projectName}${targetProject.biome ? ` · Biome: ${targetProject.biome}` : ''}`, 9.5);
    }

    y += 10;
    writeWrapped('1. Dataset & Sample Details', 12, true, [8, 122, 80]);
    writeWrapped(
      `Sample ID: ${targetDataset.sample_id} | Format: ${targetDataset.file_format.toUpperCase()} | Location: ${targetDataset.sample_location} | Collection Date: ${targetDataset.collection_date} | Type: ${targetDataset.sample_type}`,
      9.5
    );

    y += 10;
    writeWrapped('2. Biodiversity Metrics', 12, true, [8, 122, 80]);
    if (targetMetric) {
      writeWrapped(
        `Species Richness (S): ${targetMetric.species_richness} | Total Reads (N): ${targetMetric.total_reads} | Shannon Index (H'): ${Number(targetMetric.shannon_index).toFixed(4)} | Simpson Dominance (D): ${Number(targetMetric.simpson_index).toFixed(4)} | Simpson Diversity (1-D): ${Number(targetMetric.simpson_diversity).toFixed(4)} | Pielou Evenness (J): ${targetMetric.pielou_evenness !== null ? Number(targetMetric.pielou_evenness).toFixed(4) : 'N/A'}`,
        9.5
      );
    } else {
      writeWrapped('Biodiversity metrics not yet calculated for this dataset.', 9.5);
    }

    y += 10;
    writeWrapped(`3. Taxonomic Identification Results (${targetTaxa.length} records)`, 12, true, [8, 122, 80]);
    targetTaxa.slice(0, 30).forEach((t) => {
      writeWrapped(
        `• ${t.sequence_id}: ${t.scientific_name}${t.common_name ? ` (${t.common_name})` : ''} — Rank: ${t.taxonomic_rank}, Reads: ${t.read_count}, Similarity: ${t.similarity_score}%, Status: ${t.identification_status} [${t.reference_database}]`,
        9
      );
    });

    if (report?.ai_summary) {
      y += 10;
      writeWrapped('4. AI-Assisted Scientific Summary', 12, true, [8, 122, 80]);
      writeWrapped(report.ai_summary.replace(/[#*`]/g, ''), 9.5);
    }

    y += 10;
    writeWrapped('5. Methodology & Limitations', 12, true, [8, 122, 80]);
    writeWrapped(
      report?.methodology_notes ||
        "Biodiversity indices computed via Shannon-Wiener (H' = -Σ pi ln pi), Simpson Dominance (D = Σ pi²), and Pielou's Evenness (J = H' / ln S).",
      9
    );
    writeWrapped(
      report?.limitations_notes ||
        'eDNA read counts reflect amplified DNA fragment frequencies and are NOT automatically equivalent to organism biomass or population abundance.',
      9
    );

    const safeFile = targetDataset.sample_id.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`eDNA_Explorer_Report_${safeFile}.pdf`);
  };

  const handleExportCsv = () => {
    if (!activeDataset) return;
    const headers = [
      'dataset_name',
      'sample_id',
      'sequence_id',
      'scientific_name',
      'common_name',
      'taxonomic_rank',
      'taxonomic_id',
      'phylum',
      'class',
      'order',
      'family',
      'genus',
      'read_count',
      'similarity_score',
      'reference_database',
      'identification_status',
    ];
    const rows = activeTaxa.map((t) => [
      activeDataset.dataset_name,
      activeDataset.sample_id,
      t.sequence_id,
      t.scientific_name,
      t.common_name || '',
      t.taxonomic_rank,
      t.taxonomic_id || '',
      t.phylum_name || '',
      t.class_name || '',
      t.order_name || '',
      t.family_name || '',
      t.genus_name || '',
      String(t.read_count),
      String(t.similarity_score),
      t.reference_database,
      t.identification_status,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeDataset.sample_id}_taxonomic_report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Report Generator Controls */}
      <div className="no-print rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6 space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-[#063B2B] dark:text-white">
            Generate Scientific Report
          </h3>
          <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6] mt-0.5">
            Create reproducible biodiversity &amp; taxonomic reports scoped strictly to your authenticated account.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
              Target Dataset
            </label>
            <select
              value={activeDataset?.id || ''}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
            >
              {datasets.length === 0 ? (
                <option value="">No datasets uploaded</option>
              ) : (
                datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.dataset_name} ({d.sample_id})
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
              Report Title (optional)
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder={
                activeDataset ? `${activeDataset.dataset_name} — Biodiversity Report` : 'Biodiversity Report'
              }
              className="w-full px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
            />
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-[#2E5547] dark:text-[#B9D8CA] cursor-pointer">
          <input
            type="checkbox"
            checked={includeAiSummary}
            onChange={(e) => setIncludeAiSummary(e.target.checked)}
          />
          <Sparkles className="w-3.5 h-3.5 text-[#087A50]" />
          <span>Include AI-generated scientific summary grounded in actual dataset findings</span>
        </label>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            disabled={!activeDataset || generating}
            onClick={() => void handleGenerateReport()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#087A50] text-white text-xs font-medium hover:bg-[#063B2B] disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Generate &amp; Save Report
          </button>
          <button
            type="button"
            disabled={!activeDataset}
            onClick={() => handleDownloadPdf()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] text-xs font-medium hover:border-[#087A50] disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          <button
            type="button"
            disabled={!activeDataset || activeTaxa.length === 0}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] text-xs font-medium hover:border-[#087A50] disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export CSV
          </button>
          <button
            type="button"
            disabled={!activeDataset}
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] text-xs font-medium hover:border-[#087A50] disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Live Printable Report Preview */}
      {activeDataset && (
        <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6 space-y-5">
          <div className="border-b border-[#E7EFEA] dark:border-[#143A2F] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs font-mono text-[#087A50] dark:text-[#55D6C2]">
                eDNA Explorer · Scientific Report Preview
              </p>
              <h4 className="text-xl font-bold text-[#063B2B] dark:text-white mt-1">
                {reportTitle.trim() || `${activeDataset.dataset_name} — Biodiversity Report`}
              </h4>
            </div>
            <span className="text-xs font-mono text-[#4B6F61] dark:text-[#8FB7A6]">
              {new Date().toLocaleDateString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[#4B6F61] dark:text-[#8FB7A6] block">Researcher</span>
              <span className="font-medium">{profile?.fullName}</span>
            </div>
            <div>
              <span className="text-[#4B6F61] dark:text-[#8FB7A6] block">Project</span>
              <span className="font-medium">{activeProject?.projectName || 'Unassigned'}</span>
            </div>
            <div>
              <span className="text-[#4B6F61] dark:text-[#8FB7A6] block">Sample ID &amp; Location</span>
              <span className="font-medium">
                {activeDataset.sample_id} · {activeDataset.sample_location}
              </span>
            </div>
            <div>
              <span className="text-[#4B6F61] dark:text-[#8FB7A6] block">Collection Date &amp; Type</span>
              <span className="font-medium">
                {activeDataset.collection_date} · {activeDataset.sample_type}
              </span>
            </div>
          </div>

          {activeMetric && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#E7EFEA] dark:border-[#143A2F] font-mono text-xs">
              <div>
                <span className="text-[#4B6F61] dark:text-[#8FB7A6] block">Richness (S)</span>
                <span className="text-base font-bold">{activeMetric.species_richness}</span>
              </div>
              <div>
                <span className="text-[#4B6F61] dark:text-[#8FB7A6] block">Shannon (H&apos;)</span>
                <span className="text-base font-bold">{Number(activeMetric.shannon_index).toFixed(4)}</span>
              </div>
              <div>
                <span className="text-[#4B6F61] dark:text-[#8FB7A6] block">Simpson (1-D)</span>
                <span className="text-base font-bold">{Number(activeMetric.simpson_diversity).toFixed(4)}</span>
              </div>
              <div>
                <span className="text-[#4B6F61] dark:text-[#8FB7A6] block">Evenness (J)</span>
                <span className="text-base font-bold">
                  {activeMetric.pielou_evenness !== null
                    ? Number(activeMetric.pielou_evenness).toFixed(4)
                    : 'N/A'}
                </span>
              </div>
            </div>
          )}

          <div className="text-xs text-[#355E4F] dark:text-[#B9D8CA] space-y-2 pt-2 border-t border-[#E7EFEA] dark:border-[#143A2F]">
            <p>
              <strong>Methodology:</strong> Sequence validation &amp; biodiversity index computation (Shannon-Wiener, Simpson Dominance/Diversity, Pielou&apos;s Evenness) executed in eDNA Explorer.
            </p>
            <p>
              <strong>Limitations:</strong> eDNA read counts are not equivalent to organism abundance or biomass due to primer amplification bias, DNA shedding rates, and hydrologic dispersion. Any records flagged <code>demonstration_match</code> are illustrative only.
            </p>
          </div>
        </div>
      )}

      {/* Saved Reports Archive */}
      <div className="no-print rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6">
        <h4 className="text-base font-semibold text-[#063B2B] dark:text-white mb-4">
          Saved Scientific Reports ({reports.length})
        </h4>
        {reports.length === 0 ? (
          <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6]">
            No reports generated yet. Select an analyzed dataset above and click &ldquo;Generate &amp; Save Report&rdquo;.
          </p>
        ) : (
          <div className="divide-y divide-[#E7EFEA] dark:divide-[#143A2F]">
            {reports.map((rep) => (
              <div key={rep.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#063B2B] dark:text-white">{rep.report_title}</p>
                  <p className="text-xs font-mono text-[#4B6F61] dark:text-[#8FB7A6] mt-0.5">
                    Generated {new Date(rep.generated_at).toLocaleString()}
                  </p>
                  {rep.ai_summary && (
                    <p className="mt-2 text-xs text-[#2E5547] dark:text-[#B9D8CA] line-clamp-3">
                      {rep.ai_summary}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(rep)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] text-xs font-medium hover:border-[#087A50] shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
