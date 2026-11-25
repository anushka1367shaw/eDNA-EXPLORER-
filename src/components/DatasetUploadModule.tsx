import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileCode2,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import { auth } from '../lib/firebase';
import type { DatasetRecord, Project } from '../types';

interface DatasetUploadModuleProps {
  projects: Project[];
  onUploaded: (dataset: DatasetRecord) => void;
  onProceedToAnalysis: (datasetId: string) => void;
}

const VALID_EXTS = ['.csv', '.tsv', '.fasta', '.fa', '.fna', '.fastq', '.fq', '.txt'];

export function DatasetUploadModule({
  projects,
  onUploaded,
  onProceedToAnalysis,
}: DatasetUploadModuleProps) {
  const { firebaseUser } = useAuth();
  const { notify } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [datasetName, setDatasetName] = useState('');
  const [sampleId, setSampleId] = useState('');
  const [sampleLocation, setSampleLocation] = useState('');
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [sampleType, setSampleType] = useState('Freshwater Filter (0.45 µm)');
  const [organismGroup, setOrganismGroup] = useState('');
  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');

  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [loadingPreset, setLoadingPreset] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadedDataset, setUploadedDataset] = useState<DatasetRecord | null>(null);

  const validateAndSelectFile = (selected: File) => {
    setErrorMsg(null);
    const lower = selected.name.toLowerCase();
    const validExt = VALID_EXTS.some((ext) => lower.endsWith(ext));
    if (!validExt) {
      setErrorMsg(`Unsupported file format. Accepted formats: ${VALID_EXTS.join(', ')}`);
      return;
    }
    if (selected.size > 25 * 1024 * 1024) {
      setErrorMsg('File exceeds the 25 MB upload limit.');
      return;
    }
    setFile(selected);
    if (!datasetName) {
      setDatasetName(selected.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!file) {
      setErrorMsg('Please select or drop a dataset file first.');
      return;
    }
    if (!datasetName.trim() || !sampleId.trim() || !sampleLocation.trim() || !collectionDate.trim() || !sampleType.trim()) {
      setErrorMsg('Please fill in all required dataset metadata fields.');
      return;
    }

    setUploading(true);
    setUploadProgress(15);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('datasetName', datasetName.trim());
      formData.append('sampleId', sampleId.trim());
      formData.append('sampleLocation', sampleLocation.trim());
      formData.append('collectionDate', collectionDate);
      formData.append('sampleType', sampleType.trim());
      if (organismGroup.trim()) formData.append('organismGroup', organismGroup.trim());
      if (projectId) formData.append('projectId', projectId);
      if (description.trim()) formData.append('description', description.trim());

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Authentication session expired. Please sign in again.');

      const result = await new Promise<{ dataset: DatasetRecord }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/datasets/upload');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const pct = Math.min(92, Math.round((evt.loaded / evt.total) * 90));
            setUploadProgress(pct);
          }
        };

        xhr.onload = () => {
          setUploadProgress(100);
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.error || `Upload failed (${xhr.status})`));
            }
          } catch {
            reject(new Error('Unexpected server response during upload.'));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during dataset upload.'));
        xhr.send(formData);
      });

      setUploadedDataset(result.dataset);
      onUploaded(result.dataset);
      notify(
        'Dataset uploaded & validated',
        'Preview generated. Proceed to Taxonomic Identification when ready to analyze.',
        'success'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      setErrorMsg(msg);
      notify('Upload failed', msg, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleLoadSamplePreset = async (sampleKey: 'freshwater_fasta' | 'estuary_csv') => {
    setErrorMsg(null);
    setLoadingPreset(true);
    try {
      const res = await apiFetch<{ dataset: DatasetRecord }>('/api/datasets/load-sample', {
        method: 'POST',
        body: JSON.stringify({ sampleKey, projectId: projectId || null }),
      });
      setUploadedDataset(res.dataset);
      onUploaded(res.dataset);
      notify(
        'Demonstration dataset loaded',
        'Sample data is clearly labelled as Demonstration Mode.',
        'success'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load demonstration preset.';
      setErrorMsg(msg);
      notify('Load failed', msg, 'error');
    } finally {
      setLoadingPreset(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Load Demonstration Samples */}
      <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#063B2B] dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#087A50] dark:text-[#55D6C2]" />
            Demonstration Datasets (For Evaluation)
          </p>
          <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6] mt-0.5">
            Load a pre-formatted FASTA or CSV eDNA sample associated with your UID ({firebaseUser?.uid.slice(0, 8)}...) to test parsing, taxonomic matching, and biodiversity indices.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 shrink-0">
          <button
            type="button"
            disabled={loadingPreset}
            onClick={() => void handleLoadSamplePreset('freshwater_fasta')}
            className="px-3.5 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] text-xs font-medium text-[#063B2B] dark:text-white hover:border-[#087A50] disabled:opacity-50"
          >
            Load Demo FASTA
          </button>
          <button
            type="button"
            disabled={loadingPreset}
            onClick={() => void handleLoadSamplePreset('estuary_csv')}
            className="px-3.5 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] text-xs font-medium text-[#063B2B] dark:text-white hover:border-[#087A50] disabled:opacity-50"
          >
            Load Demo Estuary CSV
          </button>
        </div>
      </div>

      {/* Upload Form */}
      <form
        onSubmit={handleUploadSubmit}
        className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6 space-y-6"
      >
        <div>
          <h3 className="text-lg font-semibold text-[#063B2B] dark:text-white">
            Upload Environmental DNA Dataset
          </h3>
          <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6] mt-0.5">
            Supported formats: CSV, TSV, FASTA (.fasta, .fa, .fna), FASTQ (.fastq, .fq), and TXT up to 25 MB.
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Drag and Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
          }}
          className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-[#087A50] bg-[#E8F5EE] dark:bg-[#11382C]'
              : 'border-[#C5D8CD] dark:border-[#1D4D3E] hover:border-[#087A50]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.fasta,.fa,.fna,.fastq,.fq,.txt"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) validateAndSelectFile(e.target.files[0]);
            }}
          />
          <UploadCloud className="w-8 h-8 text-[#087A50] dark:text-[#55D6C2] mx-auto" />
          {file ? (
            <div className="mt-3">
              <p className="text-sm font-semibold text-[#063B2B] dark:text-white">{file.name}</p>
              <p className="text-xs font-mono text-[#4B6F61] dark:text-[#8FB7A6] mt-1">
                {(file.size / 1024).toFixed(1)} KB · Ready to upload
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-sm font-medium text-[#063B2B] dark:text-white">
                Drag and drop your eDNA dataset here, or click to browse
              </p>
              <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6] mt-1">
                CSV · TSV · FASTA · FASTQ · TXT (max 25 MB)
              </p>
            </div>
          )}
        </div>

        {/* Metadata Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
              Dataset Name *
            </label>
            <input
              type="text"
              required
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              placeholder="Upper Cedar River 12S Survey"
              className="w-full px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
              Sample ID *
            </label>
            <input
              type="text"
              required
              value={sampleId}
              onChange={(e) => setSampleId(e.target.value)}
              placeholder="UCR-2026-S04"
              className="w-full px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
              Collection Location *
            </label>
            <input
              type="text"
              required
              value={sampleLocation}
              onChange={(e) => setSampleLocation(e.target.value)}
              placeholder="Cedar River Watershed, WA"
              className="w-full px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
              Collection Date *
            </label>
            <input
              type="date"
              required
              value={collectionDate}
              onChange={(e) => setCollectionDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
              Sample Type *
            </label>
            <select
              value={sampleType}
              onChange={(e) => setSampleType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
            >
              <option>Freshwater Filter (0.45 µm)</option>
              <option>Marine / Estuary Water</option>
              <option>Sediment Core</option>
              <option>Forest Soil</option>
              <option>Airborne eDNA Filter</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
              Organism Group (optional)
            </label>
            <input
              type="text"
              value={organismGroup}
              onChange={(e) => setOrganismGroup(e.target.value)}
              placeholder="Vertebrates / Teleostei / Macroinvertebrates"
              className="w-full px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
              Research Project (optional)
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
            >
              <option value="">Unassigned</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectName}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
              Description / Field Notes
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Extraction method, primer set (e.g., MiFish-U / COI), filtration volume"
              className="w-full px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
            />
          </div>
        </div>

        {uploading && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span>Validating &amp; uploading dataset...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#E4EFE8] dark:bg-[#143A2F] overflow-hidden">
              <div
                className="h-full bg-[#087A50] transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#087A50] text-white text-sm font-medium hover:bg-[#063B2B] disabled:opacity-60 transition-colors"
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            Upload &amp; Validate Dataset
          </button>
        </div>
      </form>

      {/* Pre-Analysis Dataset Preview */}
      {uploadedDataset && uploadedDataset.preview_summary && (
        <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7EFEA] dark:border-[#143A2F] pb-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#087A50] dark:text-[#55D6C2] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-base font-semibold text-[#063B2B] dark:text-white">
                  Upload Confirmed — Ready for Taxonomic Analysis (Not Yet Analyzed)
                </h4>
                <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6] mt-0.5">
                  {uploadedDataset.dataset_name} · Sample {uploadedDataset.sample_id} · Status: {uploadedDataset.status}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onProceedToAnalysis(uploadedDataset.id)}
              className="px-4 py-2 rounded-lg bg-[#087A50] text-white text-xs font-medium hover:bg-[#063B2B] whitespace-nowrap shrink-0"
            >
              Proceed to Taxonomic Identification
            </button>
          </div>

          {uploadedDataset.preview_summary.kind === 'tabular' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-xs text-[#355E4F] dark:text-[#B9D8CA]">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <FileSpreadsheet className="w-4 h-4 text-[#087A50]" />
                  Showing first {uploadedDataset.preview_summary.rows.length} of{' '}
                  {uploadedDataset.preview_summary.totalRows} rows
                </span>
                <span>Columns: {uploadedDataset.preview_summary.headers.join(', ')}</span>
              </div>
              <div className="overflow-x-auto border border-[#D8E5DD] dark:border-[#143A2F] rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F4F8F5] dark:bg-[#071D17] text-[#063B2B] dark:text-white font-mono">
                    <tr>
                      {uploadedDataset.preview_summary.headers.map((h) => (
                        <th key={h} className="px-3 py-2.5 border-b border-[#D8E5DD] dark:border-[#143A2F] whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7EFEA] dark:divide-[#143A2F] font-mono">
                    {uploadedDataset.preview_summary.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#F9FCFA] dark:hover:bg-[#0F3127]">
                        {uploadedDataset.preview_summary?.kind === 'tabular' &&
                          uploadedDataset.preview_summary.headers.map((h) => (
                            <td key={h} className="px-3 py-2 whitespace-nowrap max-w-[240px] truncate">
                              {row[h]}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="rounded-lg border border-[#D8E5DD] dark:border-[#143A2F] p-3">
                  <p className="text-[11px] text-[#4B6F61] dark:text-[#8FB7A6]">Sequences</p>
                  <p className="font-mono text-lg font-bold tabular-nums mt-0.5">
                    {uploadedDataset.preview_summary.sequenceCount}
                  </p>
                </div>
                <div className="rounded-lg border border-[#D8E5DD] dark:border-[#143A2F] p-3">
                  <p className="text-[11px] text-[#4B6F61] dark:text-[#8FB7A6]">Total Bases (bp)</p>
                  <p className="font-mono text-lg font-bold tabular-nums mt-0.5">
                    {uploadedDataset.preview_summary.totalBases.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-[#D8E5DD] dark:border-[#143A2F] p-3">
                  <p className="text-[11px] text-[#4B6F61] dark:text-[#8FB7A6]">Mean Length</p>
                  <p className="font-mono text-lg font-bold tabular-nums mt-0.5">
                    {uploadedDataset.preview_summary.meanLength} bp
                  </p>
                </div>
                <div className="rounded-lg border border-[#D8E5DD] dark:border-[#143A2F] p-3">
                  <p className="text-[11px] text-[#4B6F61] dark:text-[#8FB7A6]">GC Content</p>
                  <p className="font-mono text-lg font-bold tabular-nums mt-0.5">
                    {uploadedDataset.preview_summary.gcContentPct}%
                  </p>
                </div>
                <div className="rounded-lg border border-[#D8E5DD] dark:border-[#143A2F] p-3">
                  <p className="text-[11px] text-[#4B6F61] dark:text-[#8FB7A6]">Ambiguous N</p>
                  <p className="font-mono text-lg font-bold tabular-nums mt-0.5">
                    {uploadedDataset.preview_summary.ambiguousBasePct}%
                  </p>
                </div>
                <div className="rounded-lg border border-[#D8E5DD] dark:border-[#143A2F] p-3">
                  <p className="text-[11px] text-[#4B6F61] dark:text-[#8FB7A6]">Mean Phred Q</p>
                  <p className="font-mono text-lg font-bold tabular-nums mt-0.5">
                    {uploadedDataset.preview_summary.meanQualityScore ?? 'N/A'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] flex items-center gap-1.5">
                  <FileCode2 className="w-4 h-4 text-[#087A50]" />
                  Sequence Records Preview
                </p>
                <div className="divide-y divide-[#E7EFEA] dark:divide-[#143A2F] border border-[#D8E5DD] dark:border-[#143A2F] rounded-lg">
                  {uploadedDataset.preview_summary.sampleSequences.map((seq) => (
                    <div key={seq.id} className="p-3 text-xs font-mono">
                      <div className="flex flex-wrap justify-between gap-2 text-[#063B2B] dark:text-white font-semibold">
                        <span>{seq.header}</span>
                        <span className="text-[#4B6F61] dark:text-[#8FB7A6]">
                          {seq.length} bp · GC {seq.gcPct}%
                        </span>
                      </div>
                      <p className="mt-1 text-[#355E4F] dark:text-[#B9D8CA] break-all">{seq.preview}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
