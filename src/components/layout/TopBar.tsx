import React, { useState } from 'react';
import { LogOut, Wifi, WifiOff, AlertTriangle, Settings, Lock } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useMonitorStore } from '../../store/monitorStore';
import { getQuotaPercent, getQuotaRemaining } from '../../lib/quota';
import SettingsModal from './SettingsModal';

interface TopBarProps {
  onLogout: () => void;
  activePage: 'monitor' | 'database' | 'watchlist';
}

export default function TopBar({ onLogout, activePage }: TopBarProps) {
  const { user } = useAuthStore();
  const { status, lastPollAt, totalEventsDetected } = useMonitorStore();
  const [showSettings, setShowSettings] = useState(false);
  const [backendConfigured, setBackendConfigured] = useState(false);

  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(d => {
        if (d.isConfigured) setBackendConfigured(true);
      })
      .catch(console.error);
  }, []);

  const quotaPercent = getQuotaPercent();
  const quotaRemaining = getQuotaRemaining();
  const isNearQuota = quotaPercent >= 80;

  const statusConfig = {
    idle: { label: 'Idle', color: 'text-[#666]', dot: 'bg-[#444]' },
    loading: { label: 'Connecting…', color: 'text-yellow-400', dot: 'bg-yellow-400 animate-pulse' },
    active: { label: 'Live', color: 'text-green-400', dot: 'bg-green-400 animate-pulse' },
    error: { label: 'Error', color: 'text-red-400', dot: 'bg-red-400' },
    ended: { label: 'Stream Ended', color: 'text-[#888]', dot: 'bg-[#555]' },
    quota_exceeded: { label: 'Quota Exceeded', color: 'text-orange-400', dot: 'bg-orange-400' },
  };

  const s = statusConfig[status];

  return (
    <header className="h-14 glass-panel border-b border-white/5 flex items-center px-4 gap-4 z-20 sticky top-0 backdrop-blur-xl bg-[#0a0a0a]/70">
      {/* Page title */}
      <div className="flex-1">
        <h1 className="text-white text-sm font-semibold">
          {activePage === 'monitor' ? 'Live Mod Monitor' : activePage === 'watchlist' ? 'Channel Watch List' : 'Banned Users Database'}
        </h1>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2 text-xs">
        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
        <span className={s.color}>{s.label}</span>
        {status === 'active' && (
          <>
            <span className="text-[#444]">|</span>
            <span className="text-[#666]">{totalEventsDetected} events</span>
            {lastPollAt && (
              <>
                <span className="text-[#444]">|</span>
                <div className="flex items-center gap-1 text-[#666]">
                  <Wifi size={11} />
                  <span>Last poll: {lastPollAt.toLocaleTimeString()}</span>
                </div>
              </>
            )}
          </>
        )}
        {(status === 'error' || status === 'ended' || status === 'quota_exceeded') && (
          <div className="flex items-center gap-1">
            <WifiOff size={11} className="text-[#666]" />
          </div>
        )}
      </div>

      {/* Quota indicator */}
      <div className="flex items-center gap-2">
        {isNearQuota && (
          <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 rounded-lg px-2.5 py-1">
            <AlertTriangle size={13} className="text-orange-400" />
            <span className="text-xs text-orange-400">{quotaRemaining.toLocaleString()} units left</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                quotaPercent >= 90 ? 'bg-red-500' : quotaPercent >= 70 ? 'bg-orange-400' : 'bg-green-500'
              }`}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-[#555] w-8 text-right">{Math.round(quotaPercent)}%</span>
        </div>
      </div>

      {/* User profile */}
      {user && (
        <div className="flex items-center gap-3 pl-3 border-l border-[#2a2a2a]">
          <div className="text-right hidden sm:block">
            <p className="text-white text-xs font-medium leading-tight">
              {user.channelName || user.name}
            </p>
            <p className="text-[#666] text-[10px] leading-tight">{user.email}</p>
          </div>
          <div className="relative">
            <img
              src={user.channelPicture || user.picture}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover border-2 border-[#2a2a2a]"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#111] rounded-full" />
          </div>
          
          {import.meta.env.VITE_ADMIN_PASSWORD && (
            <button
              onClick={() => {
                localStorage.removeItem('yt_mod_unlocked');
                window.location.reload();
              }}
              title="Lock Website"
              className="text-[#666] hover:text-white transition-colors p-1.5 rounded-lg hover:bg-[#1e1e1e]"
            >
              <Lock size={15} />
            </button>
          )}
          {backendConfigured ? (
            <button
              onClick={() => {
                if (confirm('Backend is already running. Do you want to re-authenticate and restart it?')) {
                  window.location.href = '/api/auth/url';
                }
              }}
              title="24/7 Backend is Running (Click to Restart)"
              className="text-green-400 hover:text-green-300 transition-colors p-1.5 rounded-lg hover:bg-green-500/10 flex items-center gap-1 border border-green-500/30 text-[10px] px-2 ml-2"
            >
              <Wifi size={13} />
              <span>24/7 Backend Running</span>
            </button>
          ) : (
            <button
              onClick={() => window.location.href = '/api/auth/url'}
              title="Authorize Backend for 24/7 Monitoring"
              className="text-[#666] hover:text-green-400 transition-colors p-1.5 rounded-lg hover:bg-green-500/10 flex items-center gap-1 border border-[#2a2a2a] hover:border-green-500/30 text-[10px] px-2 ml-2"
            >
              <Wifi size={13} />
              <span>Enable 24/7 Backend</span>
            </button>
          )}

          <button
            onClick={() => setShowSettings(true)}
            title="Settings"
            className="text-[#666] hover:text-white transition-colors p-1.5 rounded-lg hover:bg-[#1e1e1e]"
          >
            <Settings size={15} />
          </button>
          <button
            onClick={onLogout}
            title="Sign Out of Google"
            className="text-[#666] hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
          >
            <LogOut size={15} />
          </button>
        </div>
      )}
      
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </header>
  );
}
