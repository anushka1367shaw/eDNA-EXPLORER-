import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Microscope,
  Play,
  Search,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import type { BiodiversityMetrics, DatasetRecord, TaxonomicResult } from '../types';

interface TaxonomicIdentificationModuleProps {
  datasets: DatasetRecord[];
  selectedDatasetId: string | null;
  onSelectDataset: (id: string) => void;
  onAnalysisComplete: (datasetId: string, results: TaxonomicResult[], metrics: BiodiversityMetrics) => void;
}

export function TaxonomicIdentificationModule({
  datasets,
  selectedDatasetId,
  onSelectDataset,
  onAnalysisComplete,
}: TaxonomicIdentificationModuleProps) {
  const { notify } = useToast();

  const [referenceDb, setReferenceDb] = useState<'NCBI_NT' | 'BOLD' | 'SILVA'>('NCBI_NT');
  const [enableExternalLookup, setEnableExternalLookup] = useState(true);
  const [demonstrationMode, setDemonstrationMode] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const [results, setResults] = useState<TaxonomicResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [analysisNote, setAnalysisNote] = useState<string | null>(null);
  const [isDemoOutput, setIsDemoOutput] = useState(false);
  const [selectedTaxon, setSelectedTaxon] = useState<TaxonomicResult | null>(null);

  // Live NCBI / BOLD standalone lookup
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupDb, setLookupDb] = useState<'NCBI_NT' | 'BOLD'>('NCBI_NT');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState<{
    taxonomic_id: string | null;
    scientific_name: string;
    common_name?: string | null;
    taxonomic_rank: string;
  } | null>(null);

  const activeDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0] || null;

  useEffect(() => {
    if (!activeDataset) {
      setResults([]);
      return;
    }
    if (activeDataset.id !== selectedDatasetId) {
      onSelectDataset(activeDataset.id);
    }

    let cancelled = false;
    setLoadingResults(true);
    apiFetch<{ dataset: DatasetRecord; taxonomicResults: TaxonomicResult[]; biodiversityMetrics: BiodiversityMetrics | null }>(
      `/api/datasets/${activeDataset.id}`
    )
      .then((res) => {
        if (cancelled) return;
        setResults(res.taxonomicResults || []);
        setIsDemoOutput(
          Boolean(res.biodiversityMetrics?.is_demonstration) ||
            res.taxonomicResults.some((r) => r.identification_status === 'demonstration_match')
        );
        setSelectedTaxon(res.taxonomicResults?.[0] || null);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingResults(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeDataset?.id]);

  const handleRunIdentification = async () => {
    if (!activeDataset) return;
    setAnalyzing(true);
    setAnalysisNote(null);
    try {
      const res = await apiFetch<{
        taxonomicResults: TaxonomicResult[];
        biodiversityMetrics: BiodiversityMetrics;
        isDemonstration: boolean;
        notes: string;
      }>(`/api/datasets/${activeDataset.id}/analyze`, {
        method: 'POST',
        body: JSON.stringify({
          referenceDatabase: referenceDb,
          enableExternalLookup,
          demonstrationMode,
        }),
      });
      setResults(res.taxonomicResults);
      setIsDemoOutput(res.isDemonstration);
      setAnalysisNote(res.notes);
      setSelectedTaxon(res.taxonomicResults[0] || null);
      onAnalysisComplete(activeDataset.id, res.taxonomicResults, res.biodiversityMetrics);
      notify('Taxonomic analysis completed', `Processed ${res.taxonomicResults.length} sequence/taxon records.`, 'success');
    } catch (err) {
      notify('Analysis failed', err instanceof Error ? err.message : 'Unable to analyze dataset.', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStandaloneLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;
    setLookupBusy(true);
    setLookupResult(null);
    try {
      const res = await apiFetch<{
        match: {
          taxonomic_id: string | null;
          scientific_name: string;
          common_name?: string | null;
          taxonomic_rank: string;
        } | null;
      }>(`/api/taxonomic/lookup?q=${encodeURIComponent(lookupQuery.trim())}&db=${lookupDb}`);
      if (!res.match) {
        notify('No matching taxon found', `No record returned from ${lookupDb} for "${lookupQuery}".`, 'info');
      } else {
        setLookupResult(res.match);
      }
    } catch (err) {
      notify('Lookup error', err instanceof Error ? err.message : 'Taxonomy API query failed.', 'error');
    } finally {
      setLookupBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Reference Database Query */}
      <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[#063B2B] dark:text-white">
              Direct Reference Authority Lookup (NCBI Taxonomy &amp; BOLD Systems)
            </h3>
            <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6] mt-0.5">
              Query verified taxonomic identifiers and ranks directly from external reference APIs.
            </p>
          </div>
          <form onSubmit={handleStandaloneLookup} className="flex flex-wrap items-center gap-2">
            <select
              value={lookupDb}
              onChange={(e) => setLookupDb(e.target.value as 'NCBI_NT' | 'BOLD')}
              className="px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-xs"
            >
              <option value="NCBI_NT">NCBI Taxonomy</option>
              <option value="BOLD">BOLD Systems</option>
            </select>
            <input
              type="text"
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              placeholder="e.g. Salvelinus fontinalis"
              className="px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-xs w-56"
            />
            <button
              type="submit"
              disabled={lookupBusy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#087A50] text-white text-xs font-medium hover:bg-[#063B2B] disabled:opacity-50"
            >
              {lookupBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Verify Taxon
            </button>
          </form>
        </div>

        {lookupResult && (
          <div className="mt-4 pt-3 border-t border-[#E7EFEA] dark:border-[#143A2F] flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="font-mono">
              <span className="font-semibold text-[#063B2B] dark:text-white">{lookupResult.scientific_name}</span>
              {lookupResult.common_name ? ` (${lookupResult.common_name})` : ''} · Rank:{' '}
              {lookupResult.taxonomic_rank} · TaxID: {lookupResult.taxonomic_id || 'N/A'}
            </div>
            {lookupResult.taxonomic_id && lookupDb === 'NCBI_NT' && (
              <a
                href={`https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${lookupResult.taxonomic_id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#087A50] dark:text-[#55D6C2] hover:underline"
              >
                Open NCBI Record
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Dataset Analysis Controls */}
      <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
              Select Dataset
            </label>
            <select
              value={activeDataset?.id || ''}
              onChange={(e) => onSelectDataset(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
            >
              {datasets.length === 0 ? (
                <option value="">No datasets uploaded</option>
              ) : (
                datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.dataset_name} ({d.file_format.toUpperCase()})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
              Reference Database
            </label>
            <select
              value={referenceDb}
              onChange={(e) => setReferenceDb(e.target.value as 'NCBI_NT' | 'BOLD' | 'SILVA')}
              className="w-full px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
            >
              <option value="NCBI_NT">NCBI BLAST / Taxonomy (nt)</option>
              <option value="BOLD">BOLD Systems (COI Barcode)</option>
              <option value="SILVA">SILVA rRNA Reference</option>
            </select>
          </div>

          <div className="flex justify-start md:justify-end">
            <button
              type="button"
              disabled={!activeDataset || analyzing}
              onClick={() => void handleRunIdentification()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#087A50] text-white text-sm font-medium hover:bg-[#063B2B] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run Taxonomic Identification
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 pt-2 text-xs text-[#2E5547] dark:text-[#B9D8CA]">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableExternalLookup}
              onChange={(e) => setEnableExternalLookup(e.target.checked)}
              className="rounded border-[#C5D8CD]"
            />
            <span>Verify taxonomic annotations against live NCBI Taxonomy / BOLD APIs</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={demonstrationMode}
              onChange={(e) => setDemonstrationMode(e.target.checked)}
              className="rounded border-[#C5D8CD]"
            />
            <span>Enable clearly labelled Demonstration Reference Screening for raw FASTA/FASTQ</span>
          </label>
        </div>

        {(isDemoOutput || analysisNote) && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              {isDemoOutput && (
                <p className="font-semibold">
                  Demonstration Mode Output — Illustrative Reference Matches Only
                </p>
              )}
              <p className="mt-0.5 leading-relaxed">
                {analysisNote ||
                  'Records tagged demonstration_match use k-mer screening against a curated demo marker panel and are not confirmed wet-lab BLAST identifications.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Taxonomic Results + 8-Rank Hierarchy Panel */}
      {loadingResults ? (
        <div className="h-64 rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] animate-pulse" />
      ) : results.length === 0 ? (
        <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-12 text-center">
          <Microscope className="w-8 h-8 text-[#087A50] dark:text-[#55D6C2] mx-auto" />
          <p className="mt-3 text-sm font-medium text-[#063B2B] dark:text-white">
            No taxonomic identifications recorded for this dataset yet
          </p>
          <p className="mt-1 text-xs text-[#4B6F61] dark:text-[#8FB7A6]">
            Select a dataset above and click &ldquo;Run Taxonomic Identification&rdquo; to process sequences.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#D8E5DD] dark:border-[#143A2F] flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[#063B2B] dark:text-white">
                Identified Taxa ({results.length} records)
              </h4>
              <span className="text-xs text-[#4B6F61] dark:text-[#8FB7A6]">Click a row to inspect full hierarchy</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F4F8F5] dark:bg-[#071D17] text-[#063B2B] dark:text-white font-mono">
                  <tr>
                    <th className="px-4 py-2.5">Seq ID</th>
                    <th className="px-4 py-2.5">Scientific Name</th>
                    <th className="px-4 py-2.5">Rank</th>
                    <th className="px-4 py-2.5 text-right">Reads</th>
                    <th className="px-4 py-2.5 text-right">Similarity</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EFEA] dark:divide-[#143A2F]">
                  {results.map((r) => {
                    const active = selectedTaxon?.id === r.id;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedTaxon(r)}
                        className={`cursor-pointer transition-colors ${
                          active
                            ? 'bg-[#E8F5EE] dark:bg-[#11382C]'
                            : 'hover:bg-[#F9FCFA] dark:hover:bg-[#0F3127]'
                        }`}
                      >
                        <td className="px-4 py-2.5 font-mono">{r.sequence_id}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-semibold italic text-[#063B2B] dark:text-white">
                            {r.scientific_name}
                          </span>
                          {r.common_name && (
                            <span className="block text-[11px] text-[#4B6F61] dark:text-[#8FB7A6]">
                              {r.common_name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono">{r.taxonomic_rank}</td>
                        <td className="px-4 py-2.5 font-mono text-right tabular-nums">{r.read_count}</td>
                        <td className="px-4 py-2.5 font-mono text-right tabular-nums">
                          {r.similarity_score > 0 ? `${r.similarity_score}%` : '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          {r.identification_status === 'verified_lookup' && (
                            <span className="text-[#087A50] dark:text-[#55D6C2] inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Verified
                            </span>
                          )}
                          {r.identification_status === 'dataset_provided' && (
                            <span className="text-sky-700 dark:text-sky-400">Dataset</span>
                          )}
                          {r.identification_status === 'demonstration_match' && (
                            <span className="text-amber-700 dark:text-amber-300">Demo Match</span>
                          )}
                          {r.identification_status === 'unclassified' && (
                            <span className="text-slate-500">Unclassified</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 8-Level Taxonomic Hierarchy Inspector */}
          <div className="lg:col-span-4 rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5 space-y-4">
            <h4 className="text-sm font-semibold text-[#063B2B] dark:text-white border-b border-[#E7EFEA] dark:border-[#143A2F] pb-3">
              Taxonomic Classification Hierarchy
            </h4>
            {selectedTaxon ? (
              <div className="space-y-3 text-xs">
                <div>
                  <p className="text-[11px] text-[#4B6F61] dark:text-[#8FB7A6]">Scientific Name</p>
                  <p className="text-base font-semibold italic text-[#063B2B] dark:text-white">
                    {selectedTaxon.scientific_name}
                  </p>
                  {selectedTaxon.common_name && (
                    <p className="text-xs text-[#355E4F] dark:text-[#B9D8CA]">
                      Common Name: {selectedTaxon.common_name}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E7EFEA] dark:border-[#143A2F] font-mono">
                  <div>
                    <span className="text-[11px] text-[#4B6F61] dark:text-[#8FB7A6] block">Domain</span>
                    <span>{selectedTaxon.domain_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#4B6F61] dark:text-[#8FB7A6] block">Kingdom</span>
                    <span>{selectedTaxon.kingdom_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#4B6F61] dark:text-[#8FB7A6] block">Phylum</span>
                    <span>{selectedTaxon.phylum_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#4B6F61] dark:text-[#8FB7A6] block">Class</span>
                    <span>{selectedTaxon.class_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#4B6F61] dark:text-[#8FB7A6] block">Order</span>
                    <span>{selectedTaxon.order_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#4B6F61] dark:text-[#8FB7A6] block">Family</span>
                    <span>{selectedTaxon.family_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#4B6F61] dark:text-[#8FB7A6] block">Genus</span>
                    <span className="italic">{selectedTaxon.genus_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#4B6F61] dark:text-[#8FB7A6] block">Species</span>
                    <span className="italic">{selectedTaxon.species_name || '—'}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E7EFEA] dark:border-[#143A2F] space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-[#4B6F61] dark:text-[#8FB7A6]">Sequence ID</span>
                    <span>{selectedTaxon.sequence_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#4B6F61] dark:text-[#8FB7A6]">Reference DB</span>
                    <span className="text-right">{selectedTaxon.reference_database}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#4B6F61] dark:text-[#8FB7A6]">Taxon ID</span>
                    <span>{selectedTaxon.taxonomic_id || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#4B6F61] dark:text-[#8FB7A6]">Similarity Score</span>
                    <span>{selectedTaxon.similarity_score}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6]">Select a taxon row to inspect details.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
