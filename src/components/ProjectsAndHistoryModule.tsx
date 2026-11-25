import React, { useState } from 'react';
import { FolderPlus, Loader2, Trash2 } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { AnalysisJob, DatasetRecord, Project } from '../types';

export function ProjectsModule({
  projects,
  datasets,
}: {
  projects: Project[];
  datasets: DatasetRecord[];
}) {
  const { firebaseUser } = useAuth();
  const { notify, confirm } = useToast();

  const [projectName, setProjectName] = useState('');
  const [biome, setBiome] = useState('Freshwater Stream');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || projectName.trim().length < 2) return;
    setCreating(true);
    try {
      await addDoc(collection(db, 'projects'), {
        ownerUid: firebaseUser.uid,
        projectName: projectName.trim().slice(0, 150),
        biome: biome.trim().slice(0, 100),
        location: location.trim().slice(0, 200),
        description: description.trim().slice(0, 1000),
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setProjectName('');
      setLocation('');
      setDescription('');
      notify('Project created', 'Your research project is ready to organize datasets.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'projects');
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (project: Project) => {
    if (project.status === 'archived') return;
    const ok = await confirm({
      title: 'Archive Project',
      message: `Archive "${project.projectName}"? Archived projects become read-only for standard researchers.`,
      confirmLabel: 'Archive',
    });
    if (!ok) return;
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        status: 'archived',
        updatedAt: serverTimestamp(),
      });
      notify('Project archived', project.projectName, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
    }
  };

  const handleDelete = async (project: Project) => {
    const ok = await confirm({
      title: 'Delete Project',
      message: `Permanently delete project "${project.projectName}"?`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'projects', project.id));
      notify('Project deleted', project.projectName, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `projects/${project.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6 space-y-4"
      >
        <h3 className="text-base font-semibold text-[#063B2B] dark:text-white flex items-center gap-2">
          <FolderPlus className="w-4 h-4 text-[#087A50] dark:text-[#55D6C2]" />
          Create Research Project
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            required
            minLength={2}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Project Name (e.g. Olympic Watershed Survey)"
            className="px-3.5 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
          />
          <input
            type="text"
            value={biome}
            onChange={(e) => setBiome(e.target.value)}
            placeholder="Biome (e.g. Temperate Rainforest Stream)"
            className="px-3.5 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
          />
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Region / Coordinates"
            className="px-3.5 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Project objectives, target markers (e.g. COI, 12S MiFish), or sampling design"
            className="flex-1 px-3.5 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
          />
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-[#087A50] text-white text-sm font-medium hover:bg-[#063B2B] disabled:opacity-50 whitespace-nowrap"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Project
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.length === 0 ? (
          <div className="md:col-span-2 rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-10 text-center text-sm text-[#4B6F61] dark:text-[#8FB7A6]">
            No research projects created yet. Create a project above to organize your eDNA datasets.
          </div>
        ) : (
          projects.map((p) => {
            const count = datasets.filter((d) => d.project_id === p.id).length;
            return (
              <div
                key={p.id}
                className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-base font-semibold text-[#063B2B] dark:text-white">{p.projectName}</h4>
                    <span className="font-mono text-xs text-[#087A50] dark:text-[#55D6C2]">{p.status}</span>
                  </div>
                  <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6] mt-1">
                    {p.biome || 'General'} · {p.location || 'Unspecified location'} · {count} dataset(s)
                  </p>
                  {p.description && (
                    <p className="mt-2.5 text-xs text-[#2E5547] dark:text-[#B9D8CA] leading-relaxed">
                      {p.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E7EFEA] dark:border-[#143A2F]">
                  {p.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => void handleArchive(p)}
                      className="px-3 py-1.5 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] text-xs font-medium hover:border-[#087A50]"
                    >
                      Archive
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDelete(p)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-500/30 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function AnalysisHistoryModule({
  datasets,
  jobs,
  onSelectDataset,
  onDatasetDeleted,
}: {
  datasets: DatasetRecord[];
  jobs: AnalysisJob[];
  onSelectDataset: (id: string, targetTab: 'taxonomy' | 'biodiversity') => void;
  onDatasetDeleted: (id: string) => void;
}) {
  const { notify, confirm } = useToast();

  const handleDeleteDataset = async (ds: DatasetRecord) => {
    const ok = await confirm({
      title: 'Delete Dataset',
      message: `Remove "${ds.dataset_name}" and all associated taxonomic & biodiversity results?`,
      confirmLabel: 'Delete Dataset',
      destructive: true,
    });
    if (!ok) return;

    try {
      await apiFetch(`/api/datasets/${ds.id}`, { method: 'DELETE' });
      onDatasetDeleted(ds.id);
      notify('Dataset removed', ds.dataset_name, 'info');
    } catch (err) {
      notify('Delete failed', err instanceof Error ? err.message : 'Unable to delete dataset.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D8E5DD] dark:border-[#143A2F]">
          <h3 className="text-base font-semibold text-[#063B2B] dark:text-white">
            Uploaded Datasets ({datasets.length})
          </h3>
        </div>
        {datasets.length === 0 ? (
          <p className="p-8 text-center text-xs text-[#4B6F61] dark:text-[#8FB7A6]">
            No datasets uploaded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F4F8F5] dark:bg-[#071D17] font-mono">
                <tr>
                  <th className="px-4 py-2.5">Dataset</th>
                  <th className="px-4 py-2.5">Sample ID</th>
                  <th className="px-4 py-2.5">Format</th>
                  <th className="px-4 py-2.5">Location</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7EFEA] dark:divide-[#143A2F]">
                {datasets.map((ds) => (
                  <tr key={ds.id} className="hover:bg-[#F9FCFA] dark:hover:bg-[#0F3127]">
                    <td className="px-4 py-3 font-medium">{ds.dataset_name}</td>
                    <td className="px-4 py-3 font-mono">{ds.sample_id}</td>
                    <td className="px-4 py-3 font-mono uppercase">{ds.file_format}</td>
                    <td className="px-4 py-3">{ds.sample_location}</td>
                    <td className="px-4 py-3 font-mono text-[#087A50] dark:text-[#55D6C2]">{ds.status}</td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectDataset(ds.id, 'taxonomy')}
                        className="text-[#087A50] dark:text-[#55D6C2] hover:underline"
                      >
                        Taxonomy
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectDataset(ds.id, 'biodiversity')}
                        className="text-[#087A50] dark:text-[#55D6C2] hover:underline"
                      >
                        Biodiversity
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteDataset(ds)}
                        className="text-rose-600 dark:text-rose-400 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D8E5DD] dark:border-[#143A2F]">
          <h3 className="text-base font-semibold text-[#063B2B] dark:text-white">
            Analysis Job Log ({jobs.length})
          </h3>
        </div>
        {jobs.length === 0 ? (
          <p className="p-8 text-center text-xs text-[#4B6F61] dark:text-[#8FB7A6]">
            No analysis jobs executed yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left font-mono">
              <thead className="bg-[#F4F8F5] dark:bg-[#071D17]">
                <tr>
                  <th className="px-4 py-2.5">Job ID</th>
                  <th className="px-4 py-2.5">Reference DB</th>
                  <th className="px-4 py-2.5">Mode</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7EFEA] dark:divide-[#143A2F]">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-2.5">{job.id.slice(0, 8)}</td>
                    <td className="px-4 py-2.5">{job.reference_database}</td>
                    <td className="px-4 py-2.5">{job.is_demonstration ? 'Demonstration' : 'Standard'}</td>
                    <td className="px-4 py-2.5">{job.status}</td>
                    <td className="px-4 py-2.5">{new Date(job.started_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
