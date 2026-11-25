import React, { useCallback, useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthPages, VerifyEmailScreen } from './components/AuthPages';
import { BiodiversityAssessmentModule } from './components/BiodiversityAssessmentModule';
import { DashboardOverview } from './components/DashboardOverview';
import { DashboardShell, type WorkspaceTab } from './components/DashboardShell';
import { DatasetUploadModule } from './components/DatasetUploadModule';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingPage } from './components/LandingPage';
import { ProfileModule, SettingsModule } from './components/ProfileAndSettingsModule';
import { AnalysisHistoryModule, ProjectsModule } from './components/ProjectsAndHistoryModule';
import { ReportsModule } from './components/ReportsModule';
import { TaxonomicIdentificationModule } from './components/TaxonomicIdentificationModule';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { apiFetch } from './lib/api';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import type {
  AnalysisJob,
  BackendStatus,
  BiodiversityMetrics,
  DatasetRecord,
  Project,
  ReportRecord,
  TaxonomicResult,
} from './types';

function AppRoutes() {
  const { firebaseUser, loading } = useAuth();

  const [route, setRoute] = useState<string>(() => window.location.pathname || '/');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');

  // Workspace scientific state
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [allMetrics, setAllMetrics] = useState<BiodiversityMetrics[]>([]);
  const [allTaxonomicResults, setAllTaxonomicResults] = useState<TaxonomicResult[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [loadingScientificData, setLoadingScientificData] = useState(false);

  const navigate = useCallback((nextRoute: string) => {
    window.history.pushState({}, '', nextRoute);
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Load backend integration status
  useEffect(() => {
    fetch('/api/system/status')
      .then((r) => r.json())
      .then((data: BackendStatus) => setBackendStatus(data))
      .catch(() => undefined);
  }, []);

  // Subscribe to user's Firestore projects & load Supabase/sandbox scientific records
  const refreshScientificData = useCallback(async () => {
    if (!firebaseUser) return;
    setLoadingScientificData(true);
    try {
      const [dsRes, jobsRes, metricsRes, taxaRes, repRes] = await Promise.all([
        apiFetch<{ datasets: DatasetRecord[] }>('/api/datasets'),
        apiFetch<{ jobs: AnalysisJob[] }>('/api/analysis-jobs'),
        apiFetch<{ metrics: BiodiversityMetrics[] }>('/api/biodiversity/all'),
        apiFetch<{ results: TaxonomicResult[] }>('/api/taxonomic/all'),
        apiFetch<{ reports: ReportRecord[] }>('/api/reports'),
      ]);
      setDatasets(dsRes.datasets || []);
      setJobs(jobsRes.jobs || []);
      setAllMetrics(metricsRes.metrics || []);
      setAllTaxonomicResults(taxaRes.results || []);
      setReports(repRes.reports || []);
      if (dsRes.datasets?.[0] && !selectedDatasetId) {
        setSelectedDatasetId(dsRes.datasets[0].id);
      }
    } catch (err) {
      console.error('Scientific data fetch failed:', err);
    } finally {
      setLoadingScientificData(false);
    }
  }, [firebaseUser, selectedDatasetId]);

  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setProjects([]);
      setDatasets([]);
      setJobs([]);
      setAllMetrics([]);
      setAllTaxonomicResults([]);
      setReports([]);
      return;
    }

    void refreshScientificData();

    const q = query(
      collection(db, 'projects'),
      where('ownerUid', '==', firebaseUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setProjects(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, 'id'>) })));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'projects');
      }
    );
    return () => unsub();
  }, [firebaseUser, refreshScientificData]);

  // Route handling
  if (route === '/secure-admin') {
    return <AdminDashboard onNavigate={navigate} />;
  }

  if (route === '/login') {
    return <AuthPages mode="login" onNavigate={navigate} />;
  }

  if (route === '/register') {
    return <AuthPages mode="register" onNavigate={navigate} />;
  }

  if (route === '/dashboard') {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F4F8F5] dark:bg-[#071D17]">
          <p className="text-sm font-mono text-[#087A50] dark:text-[#55D6C2]">Loading workspace...</p>
        </div>
      );
    }

    if (!firebaseUser) {
      return <AuthPages mode="login" onNavigate={navigate} />;
    }

    if (!firebaseUser.emailVerified) {
      return <VerifyEmailScreen />;
    }

    return (
      <DashboardShell activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'dashboard' && (
          <DashboardOverview
            datasets={datasets}
            jobs={jobs}
            metrics={allMetrics}
            taxonomicResults={allTaxonomicResults}
            projects={projects}
            backendStatus={backendStatus}
            loadingData={loadingScientificData}
            onNavigateTab={setActiveTab}
            onSelectDataset={(id) => setSelectedDatasetId(id)}
          />
        )}

        {activeTab === 'upload' && (
          <DatasetUploadModule
            projects={projects}
            onUploaded={(ds) => {
              setDatasets((prev) => [ds, ...prev]);
              setSelectedDatasetId(ds.id);
            }}
            onProceedToAnalysis={(id) => {
              setSelectedDatasetId(id);
              setActiveTab('taxonomy');
            }}
          />
        )}

        {activeTab === 'taxonomy' && (
          <TaxonomicIdentificationModule
            datasets={datasets}
            selectedDatasetId={selectedDatasetId}
            onSelectDataset={(id) => setSelectedDatasetId(id)}
            onAnalysisComplete={(datasetId, results, metrics) => {
              setDatasets((prev) =>
                prev.map((d) => (d.id === datasetId ? { ...d, status: 'analyzed' } : d))
              );
              setAllTaxonomicResults((prev) => [
                ...prev.filter((r) => r.dataset_id !== datasetId),
                ...results,
              ]);
              setAllMetrics((prev) => [
                metrics,
                ...prev.filter((m) => m.dataset_id !== datasetId),
              ]);
              void refreshScientificData();
            }}
          />
        )}

        {activeTab === 'biodiversity' && (
          <BiodiversityAssessmentModule
            datasets={datasets}
            allMetrics={allMetrics}
            allTaxonomicResults={allTaxonomicResults}
            selectedDatasetId={selectedDatasetId}
            onSelectDataset={(id) => setSelectedDatasetId(id)}
          />
        )}

        {activeTab === 'projects' && <ProjectsModule projects={projects} datasets={datasets} />}

        {activeTab === 'history' && (
          <AnalysisHistoryModule
            datasets={datasets}
            jobs={jobs}
            onSelectDataset={(id, tab) => {
              setSelectedDatasetId(id);
              setActiveTab(tab);
            }}
            onDatasetDeleted={(id) => {
              setDatasets((prev) => prev.filter((d) => d.id !== id));
              setAllMetrics((prev) => prev.filter((m) => m.dataset_id !== id));
              setAllTaxonomicResults((prev) => prev.filter((t) => t.dataset_id !== id));
            }}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsModule
            datasets={datasets}
            allMetrics={allMetrics}
            allTaxonomicResults={allTaxonomicResults}
            projects={projects}
            reports={reports}
            onReportCreated={(rep) => setReports((prev) => [rep, ...prev])}
          />
        )}

        {activeTab === 'profile' && <ProfileModule />}

        {activeTab === 'settings' && <SettingsModule backendStatus={backendStatus} />}
      </DashboardShell>
    );
  }

  return <LandingPage onNavigate={navigate} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
