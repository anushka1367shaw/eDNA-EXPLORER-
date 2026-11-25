import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  Clock,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Microscope,
  Moon,
  Settings,
  Sun,
  Upload,
  User,
  X,
} from 'lucide-react';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { Announcement, AppNotification } from '../types';
import { LogoMark } from './LogoMark';

export type WorkspaceTab =
  | 'dashboard'
  | 'upload'
  | 'taxonomy'
  | 'biodiversity'
  | 'projects'
  | 'history'
  | 'reports'
  | 'profile'
  | 'settings';

interface DashboardShellProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'upload', label: 'Upload Dataset', icon: Upload },
  { id: 'taxonomy', label: 'Taxonomic Identification', icon: Microscope },
  { id: 'biodiversity', label: 'Biodiversity Assessment', icon: BarChart3 },
  { id: 'projects', label: 'My Projects', icon: FolderKanban },
  { id: 'history', label: 'Analysis History', icon: Clock },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function DashboardShell({ activeTab, onTabChange, children }: DashboardShellProps) {
  const { firebaseUser, profile, theme, toggleTheme, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', firebaseUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotifications(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) }))
        );
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'notifications');
      }
    );

    const annQ = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubAnn = onSnapshot(
      annQ,
      (snap) => {
        setAnnouncements(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }))
            .filter((a) => a.active)
        );
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'announcements');
      }
    );

    return () => {
      unsub();
      unsubAnn();
    };
  }, [firebaseUser]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${notifId}`);
    }
  };

  const activeTitle = NAV_ITEMS.find((i) => i.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="min-h-screen flex bg-[#F4F8F5] dark:bg-[#071D17] text-[#063B2B] dark:text-[#ECF5F0]">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Responsive Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 w-64 border-r border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 border-b border-[#D8E5DD] dark:border-[#143A2F] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <LogoMark size={28} />
            <span className="font-display font-bold text-base text-[#063B2B] dark:text-white truncate">
              eDNA Explorer
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-[#F4F8F5] dark:hover:bg-[#113329]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onTabChange(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  active
                    ? 'bg-[#087A50] text-white'
                    : 'text-[#2E5547] dark:text-[#B9D8CA] hover:bg-[#E8F3EC] dark:hover:bg-[#11382C]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#D8E5DD] dark:border-[#143A2F]">
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Workspace Top Header */}
        <header className="no-print h-16 px-4 sm:px-6 border-b border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-[#063B2B] dark:text-white hover:bg-[#F4F8F5] dark:hover:bg-[#113329]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display font-semibold text-base sm:text-lg text-[#063B2B] dark:text-white truncate">
                {activeTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => void toggleTheme()}
              aria-label="Toggle light or dark mode"
              className="p-2 rounded-lg text-[#2E5547] dark:text-[#B9D8CA] hover:bg-[#F4F8F5] dark:hover:bg-[#113329] transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notifications"
                className="relative p-2 rounded-lg text-[#2E5547] dark:text-[#B9D8CA] hover:bg-[#F4F8F5] dark:hover:bg-[#113329] transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#087A50] text-white font-mono text-[10px] flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] shadow-xl p-3 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-[#D8E5DD] dark:border-[#143A2F]">
                    <span className="text-xs font-semibold text-[#063B2B] dark:text-white">
                      Notifications
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Close
                    </button>
                  </div>
                  <div className="mt-2 max-h-64 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <p className="py-6 text-center text-xs text-[#4B6F61] dark:text-[#8FB7A6]">
                        No notifications yet.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => void markAsRead(n.id)}
                          className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${
                            n.read
                              ? 'border-transparent bg-transparent opacity-70'
                              : 'border-[#D8E5DD] dark:border-[#143A2F] bg-[#F4F8F5] dark:bg-[#071D17]'
                          }`}
                        >
                          <p className="font-medium text-[#063B2B] dark:text-white">{n.title}</p>
                          <p className="mt-0.5 text-[#355E4F] dark:text-[#B9D8CA]">{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onTabChange('profile')}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg border border-[#D8E5DD] dark:border-[#143A2F] hover:border-[#087A50] transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-[#087A50] text-white text-xs font-semibold flex items-center justify-center overflow-hidden">
                {profile?.photoUrl ? (
                  <img
                    src={profile.photoUrl}
                    alt={profile.fullName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (profile?.fullName?.[0] || 'R').toUpperCase()
                )}
              </div>
              <span className="hidden sm:inline text-xs font-medium text-[#063B2B] dark:text-white max-w-[140px] truncate">
                {profile?.fullName || 'Researcher'}
              </span>
            </button>
          </div>
        </header>

        {/* Active Announcements Banner */}
        {announcements.length > 0 && (
          <div className="no-print border-b border-[#D8E5DD] dark:border-[#143A2F] bg-[#E8F5EE] dark:bg-[#0E3328] px-4 sm:px-6 py-2.5">
            <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs text-[#063B2B] dark:text-[#ECF5F0]">
              <FileSpreadsheet className="w-4 h-4 text-[#087A50] dark:text-[#55D6C2] shrink-0" />
              <span className="font-semibold">{announcements[0].title}:</span>
              <span className="truncate">{announcements[0].body}</span>
            </div>
          </div>
        )}

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
