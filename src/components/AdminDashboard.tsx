import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Database,
  LogOut,
  Megaphone,
  Search,
  ShieldAlert,
  Terminal,
  Trash2,
  Users,
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  AdminAuditLog,
  AnalysisJob,
  Announcement,
  DatasetRecord,
  SystemLogEntry,
  UserProfile,
} from '../types';
import { LogoMark } from './LogoMark';

interface AdminDashboardProps {
  onNavigate: (route: string) => void;
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const { firebaseUser, isAdmin, loading, logout } = useAuth();
  const { notify, confirm } = useToast();

  const [tab, setTab] = useState<'overview' | 'users' | 'datasets' | 'monitoring' | 'system'>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);
  const [stats, setStats] = useState<{
    totalDatasets: number;
    totalAnalyses: number;
    failedJobs: number;
    totalSpeciesRecords: number;
    totalStorageBytes: number;
  } | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser || !isAdmin) return;

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setUsers(snap.docs.map((d) => d.data() as UserProfile));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubAudit = onSnapshot(
      query(collection(db, 'adminAuditLogs'), orderBy('createdAt', 'desc')),
      (snap) => {
        setAuditLogs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminAuditLog, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'adminAuditLogs')
    );

    const unsubAnn = onSnapshot(
      query(collection(db, 'announcements'), orderBy('createdAt', 'desc')),
      (snap) => {
        setAnnouncements(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'announcements')
    );

    apiFetch<{
      stats: {
        totalDatasets: number;
        totalAnalyses: number;
        failedJobs: number;
        totalSpeciesRecords: number;
        totalStorageBytes: number;
        allJobs: AnalysisJob[];
      };
      datasets: DatasetRecord[];
      logs: SystemLogEntry[];
    }>('/api/admin/overview')
      .then((res) => {
        setStats(res.stats);
        setJobs(res.stats.allJobs || []);
        setDatasets(res.datasets || []);
        setSystemLogs(res.logs || []);
      })
      .catch((err) => {
        notify('Admin telemetry error', err instanceof Error ? err.message : 'Unable to load server stats.', 'error');
      });

    return () => {
      unsubUsers();
      unsubAudit();
      unsubAnn();
    };
  }, [firebaseUser, isAdmin, loading, notify]);

  // Redirect unauthorized visitors safely
  useEffect(() => {
    if (!loading && (!firebaseUser || !isAdmin)) {
      const timer = setTimeout(() => {
        onNavigate(firebaseUser ? '/dashboard' : '/');
      }, 2800);
      return () => clearTimeout(timer);
    }
  }, [firebaseUser, isAdmin, loading, onNavigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F8F5] dark:bg-[#071D17]">
        <p className="text-sm font-mono">Verifying server-side administrator credentials...</p>
      </div>
    );
  }

  if (!firebaseUser || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F8F5] dark:bg-[#071D17] p-6">
        <div className="max-w-md w-full rounded-xl border border-rose-500/40 bg-white dark:bg-[#0B271F] p-8 text-center shadow-lg">
          <ShieldAlert className="w-10 h-10 text-rose-600 dark:text-rose-400 mx-auto" />
          <h1 className="mt-4 text-xl font-bold text-[#063B2B] dark:text-white">Access Denied</h1>
          <p className="mt-2 text-sm text-[#355E4F] dark:text-[#B9D8CA]">
            This restricted administrative portal requires server-verified administrator privileges. Redirecting safely...
          </p>
          <button
            type="button"
            onClick={() => onNavigate(firebaseUser ? '/dashboard' : '/')}
            className="mt-6 px-4 py-2 rounded-lg bg-[#087A50] text-white text-xs font-medium"
          >
            Return Safely
          </button>
        </div>
      </div>
    );
  }

  const writeAuditLog = async (action: string, targetId: string, details: string) => {
    try {
      await addDoc(collection(db, 'adminAuditLogs'), {
        actorUid: firebaseUser.uid,
        actorEmail: firebaseUser.email || 'admin@edna-explorer.org',
        action: action.slice(0, 120),
        targetId: targetId.slice(0, 128),
        details: details.slice(0, 1000),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'adminAuditLogs');
    }
  };

  const handleToggleUserStatus = async (target: UserProfile) => {
    if (target.uid === firebaseUser.uid) {
      notify('Action blocked', 'Administrators cannot suspend their own active session.', 'warning');
      return;
    }
    const nextStatus = target.accountStatus === 'active' ? 'suspended' : 'active';
    const ok = await confirm({
      title: `${nextStatus === 'suspended' ? 'Suspend' : 'Reactivate'} Account`,
      message: `${nextStatus === 'suspended' ? 'Suspend' : 'Reactivate'} researcher ${target.fullName} (${target.email})?`,
      confirmLabel: nextStatus === 'suspended' ? 'Suspend' : 'Reactivate',
      destructive: nextStatus === 'suspended',
    });
    if (!ok) return;

    try {
      await updateDoc(doc(db, 'users', target.uid), {
        accountStatus: nextStatus,
        lastLogin: serverTimestamp(),
      });
      await writeAuditLog(
        `user_${nextStatus}`,
        target.uid,
        `Changed accountStatus of ${target.email} to ${nextStatus}`
      );
      notify('Account updated', `${target.email} is now ${nextStatus}.`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${target.uid}`);
    }
  };

  const handleRemoveDataset = async (ds: DatasetRecord) => {
    const ok = await confirm({
      title: 'Remove Dataset',
      message: `Permanently delete dataset "${ds.dataset_name}" uploaded by ${ds.firebase_uid}?`,
      confirmLabel: 'Remove Dataset',
      destructive: true,
    });
    if (!ok) return;

    try {
      await apiFetch(`/api/admin/datasets/${ds.id}`, { method: 'DELETE' });
      setDatasets((prev) => prev.filter((item) => item.id !== ds.id));
      await writeAuditLog('dataset_removed', ds.id, `Removed dataset "${ds.dataset_name}"`);
      notify('Dataset removed', ds.dataset_name, 'info');
    } catch (err) {
      notify('Delete failed', err instanceof Error ? err.message : 'Unable to remove dataset.', 'error');
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annBody.trim()) return;
    try {
      await addDoc(collection(db, 'announcements'), {
        title: annTitle.trim().slice(0, 160),
        body: annBody.trim().slice(0, 1000),
        active: true,
        createdBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
      });
      await writeAuditLog('announcement_created', 'announcements', `Published "${annTitle.trim()}"`);
      setAnnTitle('');
      setAnnBody('');
      notify('Announcement published', 'Active researchers will see this announcement.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'announcements');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
      await writeAuditLog('announcement_deleted', id, 'Deleted system announcement');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `announcements/${id}`);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.institution || '').toLowerCase().includes(q)
    );
  });

  const activeUsersCount = users.filter((u) => u.accountStatus === 'active').length;

  return (
    <div className="min-h-screen bg-[#F4F8F5] dark:bg-[#071D17] text-[#063B2B] dark:text-[#ECF5F0]">
      <header className="h-16 px-6 border-b border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LogoMark size={28} />
          <div>
            <h1 className="font-display font-bold text-base text-[#063B2B] dark:text-white">
              eDNA Explorer — Restricted Admin Console
            </h1>
            <p className="text-[11px] font-mono text-[#087A50] dark:text-[#55D6C2]">
              Verified Administrator: {firebaseUser.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="px-3 py-1.5 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] text-xs font-medium"
          >
            Researcher View
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Admin Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[#D8E5DD] dark:border-[#143A2F] pb-3">
          {[
            { id: 'overview', label: 'Overview', icon: Database },
            { id: 'users', label: 'User Management', icon: Users },
            { id: 'datasets', label: 'Dataset Management', icon: Trash2 },
            { id: 'monitoring', label: 'Research Monitoring', icon: AlertTriangle },
            { id: 'system', label: 'System Management', icon: Terminal },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as typeof tab)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                  tab === item.id
                    ? 'bg-[#087A50] text-white'
                    : 'bg-white dark:bg-[#0B271F] border border-[#D8E5DD] dark:border-[#143A2F] hover:border-[#087A50]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* A. Overview */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
              <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6]">Total Registered Users</p>
              <p className="mt-2 text-2xl font-mono font-bold tabular-nums">{users.length}</p>
            </div>
            <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
              <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6]">Active Users</p>
              <p className="mt-2 text-2xl font-mono font-bold text-[#087A50] dark:text-[#55D6C2] tabular-nums">
                {activeUsersCount}
              </p>
            </div>
            <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
              <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6]">Total Datasets</p>
              <p className="mt-2 text-2xl font-mono font-bold tabular-nums">{stats?.totalDatasets ?? 0}</p>
            </div>
            <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
              <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6]">Total Analyses</p>
              <p className="mt-2 text-2xl font-mono font-bold tabular-nums">{stats?.totalAnalyses ?? 0}</p>
            </div>
            <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
              <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6]">Species Records</p>
              <p className="mt-2 text-2xl font-mono font-bold tabular-nums">{stats?.totalSpeciesRecords ?? 0}</p>
            </div>
          </div>
        )}

        {/* B. User Management */}
        {tab === 'users' && (
          <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] overflow-hidden">
            <div className="p-4 border-b border-[#D8E5DD] dark:border-[#143A2F] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Registered Researchers ({filteredUsers.length})</h2>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search name, email, institution..."
                  className="pl-9 pr-3 py-1.5 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-xs w-64"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F4F8F5] dark:bg-[#071D17] font-mono">
                  <tr>
                    <th className="px-4 py-2.5">Researcher</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Institution</th>
                    <th className="px-4 py-2.5">Role</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EFEA] dark:divide-[#143A2F]">
                  {filteredUsers.map((u) => (
                    <tr key={u.uid}>
                      <td className="px-4 py-2.5 font-medium">{u.fullName}</td>
                      <td className="px-4 py-2.5 font-mono">{u.email}</td>
                      <td className="px-4 py-2.5">{u.institution || '—'}</td>
                      <td className="px-4 py-2.5 font-mono">{u.role}</td>
                      <td className="px-4 py-2.5 font-mono">{u.accountStatus}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => void handleToggleUserStatus(u)}
                          className={`text-xs font-medium hover:underline ${
                            u.accountStatus === 'active'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-[#087A50] dark:text-[#55D6C2]'
                          }`}
                        >
                          {u.accountStatus === 'active' ? 'Suspend' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* C. Dataset Management */}
        {tab === 'datasets' && (
          <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] overflow-hidden">
            <div className="p-4 border-b border-[#D8E5DD] dark:border-[#143A2F]">
              <h2 className="text-sm font-semibold">All Platform Datasets ({datasets.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F4F8F5] dark:bg-[#071D17] font-mono">
                  <tr>
                    <th className="px-4 py-2.5">Dataset</th>
                    <th className="px-4 py-2.5">Owner UID</th>
                    <th className="px-4 py-2.5">Format</th>
                    <th className="px-4 py-2.5">Size</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Moderation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EFEA] dark:divide-[#143A2F]">
                  {datasets.map((ds) => (
                    <tr key={ds.id}>
                      <td className="px-4 py-2.5 font-medium">{ds.dataset_name}</td>
                      <td className="px-4 py-2.5 font-mono">{ds.firebase_uid.slice(0, 12)}...</td>
                      <td className="px-4 py-2.5 font-mono uppercase">{ds.file_format}</td>
                      <td className="px-4 py-2.5 font-mono">{(ds.file_size_bytes / 1024).toFixed(1)} KB</td>
                      <td className="px-4 py-2.5 font-mono">{ds.status}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => void handleRemoveDataset(ds)}
                          className="text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* D. Research Monitoring */}
        {tab === 'monitoring' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5 flex flex-wrap gap-6 text-xs font-mono">
              <span>Total Jobs: {jobs.length}</span>
              <span>Failed Jobs: {stats?.failedJobs ?? 0}</span>
              <span>Storage Footprint: {((stats?.totalStorageBytes ?? 0) / 1024).toFixed(1)} KB</span>
            </div>
            <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left font-mono">
                  <thead className="bg-[#F4F8F5] dark:bg-[#071D17]">
                    <tr>
                      <th className="px-4 py-2.5">Job ID</th>
                      <th className="px-4 py-2.5">Dataset</th>
                      <th className="px-4 py-2.5">Database</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Error Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7EFEA] dark:divide-[#143A2F]">
                    {jobs.map((j) => (
                      <tr key={j.id}>
                        <td className="px-4 py-2.5">{j.id.slice(0, 8)}</td>
                        <td className="px-4 py-2.5">{j.dataset_id.slice(0, 8)}</td>
                        <td className="px-4 py-2.5">{j.reference_database}</td>
                        <td className="px-4 py-2.5">{j.status}</td>
                        <td className="px-4 py-2.5 text-rose-600 dark:text-rose-400">{j.error_message || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* E. System Management (Announcements, Audit Logs, System Logs) */}
        {tab === 'system' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-6">
              <form
                onSubmit={handleCreateAnnouncement}
                className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5 space-y-3"
              >
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-[#087A50]" />
                  Publish System Announcement
                </h3>
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Announcement title"
                  className="w-full px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-xs"
                />
                <textarea
                  required
                  rows={3}
                  value={annBody}
                  onChange={(e) => setAnnBody(e.target.value)}
                  placeholder="Message for active researchers..."
                  className="w-full px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-xs"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#087A50] text-white text-xs font-medium hover:bg-[#063B2B]"
                >
                  Publish Announcement
                </button>
              </form>

              <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5 space-y-2">
                <h3 className="text-sm font-semibold">Active Announcements ({announcements.length})</h3>
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-lg border border-[#E7EFEA] dark:border-[#143A2F] flex justify-between items-start gap-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold">{a.title}</p>
                      <p className="text-[#4B6F61] dark:text-[#8FB7A6] mt-0.5">{a.body}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteAnnouncement(a.id)}
                      className="text-rose-600 hover:underline shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
                <h3 className="text-sm font-semibold mb-3">Admin Audit Logs ({auditLogs.length})</h3>
                <div className="max-h-56 overflow-y-auto divide-y divide-[#E7EFEA] dark:divide-[#143A2F] text-xs font-mono">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="py-2">
                      <span className="font-semibold text-[#087A50] dark:text-[#55D6C2]">{log.action}</span> ·{' '}
                      <span>{log.actorEmail}</span> — {log.details}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-5">
                <h3 className="text-sm font-semibold mb-3">Server Security &amp; Processing Logs ({systemLogs.length})</h3>
                <div className="max-h-56 overflow-y-auto divide-y divide-[#E7EFEA] dark:divide-[#143A2F] text-xs font-mono">
                  {systemLogs.map((l) => (
                    <div key={l.id} className="py-2">
                      <span className="uppercase font-semibold">{l.level}</span> [{l.source}] {l.message}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
