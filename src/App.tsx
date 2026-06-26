import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useTokenRefresh } from './hooks/useTokenRefresh';
import { useChannelWatcher } from './hooks/useChannelWatcher';
import { useYouTubePoller } from './hooks/useYouTubePoller';
import LoginPage from './components/auth/LoginPage';
import AdminLockPage from './components/auth/AdminLockPage';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import MonitorPage from './pages/MonitorPage';
import DatabasePage from './pages/DatabasePage';
import WatchListPage from './pages/WatchListPage';

type Page = 'monitor' | 'database' | 'watchlist';

function AppContent() {
  const { isAuthenticated, accessToken, logout } = useAuthStore();
  const [currentPage, setCurrentPage] = useState<Page>('monitor');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Auto-refresh the access token before it expires
  useTokenRefresh();

  // Background channel live-status watcher (polls every 2 min)
  useChannelWatcher();

  // Background live chat poller (polls continuously while a stream is active)
  useYouTubePoller();

  const handleLogout = () => {
    if (accessToken && window.google?.accounts?.oauth2) {
      (window.google.accounts.oauth2 as unknown as { revoke: (t: string, cb: () => void) => void }).revoke(accessToken, () => {});
    }
    logout();
  };

  if (!isAuthenticated) {
    return <LoginPage onAuthenticated={() => {}} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050505] text-white relative">
      {/* Subtle Background Glow & Grid */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_right,rgba(255,0,0,0.05),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(255,0,0,0.03),transparent_40%)]" />
      <div className="absolute inset-0 z-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
      
      <div className="flex h-full w-full z-10">
        <Sidebar
        activePage={currentPage}
        onNavigate={setCurrentPage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onLogout={handleLogout} activePage={currentPage} />
        <main className="flex-1 overflow-hidden min-h-0">
          {currentPage === 'monitor' && <MonitorPage />}
          {currentPage === 'watchlist' && <WatchListPage />}
          {currentPage === 'database' && <DatabasePage />}
        </main>
      </div>
    </div>
    </div>
  );
}

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    // If no password is configured, the app is unlocked by default
    if (!import.meta.env.VITE_ADMIN_PASSWORD) return true;
    return localStorage.getItem('yt_mod_unlocked') === 'true';
  });

  if (!isUnlocked) {
    return <AdminLockPage onUnlock={() => setIsUnlocked(true)} />;
  }

  return (
    <>
      <AppContent />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            fontSize: '13px',
          },
        }}
      />
    </>
  );
}
