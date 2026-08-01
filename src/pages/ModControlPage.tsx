import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Play, Square, RefreshCw, Radio, Tv, ShieldCheck, ExternalLink, AlertCircle, Sparkles, Tv2, Lock, Activity, Zap, CheckCircle2 } from 'lucide-react';

interface WatchedChannel {
  _id: string;
  channel_id: string;
  display_name: string;
  profile_pic_url?: string;
  is_live: boolean;
  auto_monitor: boolean;
  current_video_id?: string;
  current_live_chat_id?: string;
  last_checked?: string;
}

interface ActiveMonitor {
  channelId: string;
  liveChatId: string;
  videoId?: string;
}

interface ModControlPageProps {
  standalone?: boolean;
}

export default function ModControlPage({ standalone = false }: ModControlPageProps) {
  const [streamUrl, setStreamUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [watchedChannels, setWatchedChannels] = useState<WatchedChannel[]>([]);
  const [activeMonitors, setActiveMonitors] = useState<ActiveMonitor[]>([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const fetchStatus = async (showToast = false) => {
    setRefreshing(true);
    try {
      const [channelsRes, statusRes] = await Promise.all([
        fetch('/api/watched-channels').then(r => r.json()),
        fetch('/api/monitor/status').then(r => r.json())
      ]);

      if (Array.isArray(channelsRes)) {
        setWatchedChannels(channelsRes);
      }
      if (statusRes && Array.isArray(statusRes.activeMonitors)) {
        setActiveMonitors(statusRes.activeMonitors);
      }
      setLastRefreshedAt(new Date());

      if (showToast) {
        toast.success('Status updated successfully!', { icon: '🔄' });
      }
    } catch (err) {
      console.error('Failed to refresh stream status:', err);
      if (showToast) {
        toast.error('Failed to refresh status');
      }
    } finally {
      setRefreshing(false);
    }
  };

  // ONLY fetch once on initial mount (NO automatic background polling loop)
  useEffect(() => {
    fetchStatus(false);
  }, []);

  const handleStartMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamUrl.trim()) {
      toast.error('Please enter a YouTube Stream URL or Video ID');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Resolving YouTube Stream & Starting Monitor...');

    try {
      const res = await fetch('/api/public/start-monitor-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: streamUrl.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to start monitor');
      }

      toast.success(data.message || 'Started monitoring successfully!', { id: toastId });
      setStreamUrl('');
      await fetchStatus(false);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleStopMonitor = async (channelId: string, channelName: string) => {
    const toastId = toast.loading(`Stopping monitor for ${channelName}...`);
    try {
      const res = await fetch('/api/public/stop-monitor-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to stop monitor');
      }

      toast.success(`Stopped monitoring ${channelName}`, { id: toastId });
      await fetchStatus(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to stop monitor', { id: toastId });
    }
  };

  const activeLiveChannels = watchedChannels.filter(c => c.is_live);

  return (
    <div className={`min-h-screen bg-[#050505] text-white flex flex-col ${standalone ? 'w-full overflow-y-auto' : 'h-full overflow-y-auto p-6 space-y-6'}`}>
      {/* Standalone Top Navigation Header */}
      {standalone && (
        <header className="h-16 border-b border-neutral-800/80 bg-[#0a0a0a]/90 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-red-600 to-red-500 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(255,0,0,0.5)] transition-transform hover:scale-105">
              <Tv2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-white tracking-tight">YT Mod Monitor</span>
                <span className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider text-red-400 bg-red-950/80 border border-red-800/80 rounded-full flex items-center gap-1 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Mod Control
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">Public Stream Control Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-all shadow-md active:scale-95"
            >
              <Lock className="w-3.5 h-3.5 text-neutral-400" />
              Admin Login
            </a>
          </div>
        </header>
      )}

      {/* Main Scrollable Content Wrapper */}
      <div className={`flex-1 w-full max-w-7xl mx-auto space-y-8 pb-16 ${standalone ? 'p-6 md:p-8' : ''}`}>
        
        {/* Hero Section Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-950/50 via-neutral-950 to-purple-950/30 p-8 border border-red-900/40 shadow-[0_0_50px_rgba(255,0,0,0.08)] animate-slide-in">
          {/* Animated Background Mesh Glow */}
          <div className="absolute top-0 right-0 p-12 opacity-15 pointer-events-none">
            <Radio className="w-64 h-64 text-red-500 animate-pulse" />
          </div>
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-red-400 bg-red-950/80 border border-red-800/80 rounded-full shadow-inner">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  Moderator Hub
                </span>
                <span className="px-3 py-1 text-xs font-medium text-neutral-400 bg-neutral-900/80 border border-neutral-800 rounded-full">
                  Manual Control Portal
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
                Stream Monitoring Control Center
              </h1>
              <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
                Paste any active YouTube Live Stream link or Video ID to manually launch real-time chat moderation and event tracking.
              </p>
            </div>

            {/* MANUAL REFRESH BUTTON (NO AUTOMATIC POLLING) */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <button
                onClick={() => fetchStatus(true)}
                disabled={refreshing}
                className="group relative flex items-center gap-2.5 px-5 py-3 text-xs font-bold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 border border-red-500/40 rounded-xl transition-all shadow-[0_0_20px_rgba(255,0,0,0.25)] hover:shadow-[0_0_30px_rgba(255,0,0,0.4)] active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-white' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                <span>{refreshing ? 'Updating Status...' : 'Refresh Status'}</span>
              </button>
              <div className="text-[11px] text-neutral-500 font-medium">
                {lastRefreshedAt ? `Last refreshed: ${lastRefreshedAt.toLocaleTimeString()}` : 'Manual refresh only'}
              </div>
            </div>
          </div>

          {/* System Metrics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-neutral-800/80">
            <div className="group flex items-center gap-4 p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800/60 hover:border-red-500/40 transition-all hover:shadow-[0_0_15px_rgba(255,0,0,0.1)]">
              <div className="p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 group-hover:scale-110 transition-transform">
                <Radio className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-neutral-400 font-medium">Currently Live & Monitored</div>
                <div className="text-xl font-extrabold text-white mt-0.5">{activeMonitors.length} <span className="text-xs font-normal text-neutral-500">streams</span></div>
              </div>
            </div>

            <div className="group flex items-center gap-4 p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800/60 hover:border-purple-500/40 transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.1)]">
              <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:scale-110 transition-transform">
                <Tv className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-neutral-400 font-medium">Total Configured Channels</div>
                <div className="text-xl font-extrabold text-white mt-0.5">{watchedChannels.length} <span className="text-xs font-normal text-neutral-500">channels</span></div>
              </div>
            </div>

            <div className="group flex items-center gap-4 p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800/60 hover:border-emerald-500/40 transition-all hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-neutral-400 font-medium">Monitoring Engine</div>
                <div className="text-base font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Active & Ready
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Start Monitoring Input Form */}
        <div className="rounded-3xl bg-neutral-900/60 border border-neutral-800 p-8 shadow-2xl backdrop-blur-md transition-all hover:border-neutral-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-red-600/10 border border-red-500/20 text-red-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">Start New Stream Monitor</h2>
              <p className="text-xs text-neutral-400">
                Paste YouTube live stream link or Video ID to resolve live chat details and start logging.
              </p>
            </div>
          </div>

          <form onSubmit={handleStartMonitor} className="space-y-4 mt-6">
            <div className="relative">
              <input
                type="text"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ  or  video_id_here"
                className="w-full pl-5 pr-40 py-4 bg-neutral-950 border border-neutral-800 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/30 transition-all shadow-inner"
              />
              <button
                type="submit"
                disabled={loading || !streamUrl.trim()}
                className="absolute right-2 top-2 bottom-2 px-6 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs rounded-xl transition-all shadow-lg flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Start Monitor
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
              <span className="font-semibold text-neutral-500">Accepted Link Formats:</span>
              <code className="px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded-lg text-red-400 font-mono">https://youtube.com/watch?v=...</code>
              <code className="px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded-lg text-red-400 font-mono">https://youtu.be/...</code>
              <code className="px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded-lg text-red-400 font-mono">Direct Video ID</code>
            </div>
          </form>
        </div>

        {/* Active Monitored Streams Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Radio className="w-5 h-5 text-red-500 animate-pulse" />
              Active Live Monitors ({activeLiveChannels.length})
            </h2>
            <div className="text-xs text-neutral-500 font-medium">
              Click <span className="text-neutral-300 font-semibold">Refresh Status</span> above to update
            </div>
          </div>

          {activeLiveChannels.length === 0 ? (
            <div className="rounded-3xl border border-neutral-800/80 bg-neutral-900/30 p-10 text-center space-y-3 shadow-inner">
              <div className="inline-flex p-4 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-500">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="text-base font-bold text-neutral-200">No Live Streams Currently Monitored</div>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                Paste a YouTube stream link in the box above and click Start Monitor to initiate monitoring.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeLiveChannels.map((channel) => (
                <div
                  key={channel._id || channel.channel_id}
                  className="group relative rounded-3xl bg-neutral-900/70 border border-neutral-800/90 p-6 hover:border-red-500/50 transition-all duration-300 flex flex-col justify-between shadow-2xl hover:shadow-[0_0_30px_rgba(255,0,0,0.15)] hover:-translate-y-1"
                >
                  <div>
                    {/* Channel Profile Header */}
                    <div className="flex items-center gap-3.5 mb-4">
                      {channel.profile_pic_url ? (
                        <img
                          src={channel.profile_pic_url}
                          alt={channel.display_name}
                          className="w-12 h-12 rounded-full border-2 border-neutral-700 object-cover group-hover:border-red-500 transition-colors"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-red-950/80 border-2 border-red-800/80 flex items-center justify-center text-red-400 font-extrabold text-lg">
                          {channel.display_name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white truncate">{channel.display_name}</h3>
                          <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-red-400 bg-red-950/90 border border-red-800/90 rounded-md flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                            LIVE
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 truncate">ID: {channel.channel_id}</p>
                      </div>
                    </div>

                    {/* Stream Details Pill */}
                    {channel.current_video_id && (
                      <div className="my-4 p-3 rounded-2xl bg-neutral-950 border border-neutral-800/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-neutral-300 min-w-0">
                          <Tv className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                          <span className="truncate font-mono font-medium">ID: {channel.current_video_id}</span>
                        </div>
                        <a
                          href={`https://youtube.com/watch?v=${channel.current_video_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-red-400 hover:text-red-300 flex items-center gap-1 text-xs font-semibold flex-shrink-0 ml-2"
                        >
                          Watch <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 border-t border-neutral-800/80 flex items-center justify-between gap-2 mt-2">
                    <div className="text-[11px] text-neutral-500 font-medium">
                      {channel.last_checked ? `Checked: ${new Date(channel.last_checked).toLocaleTimeString()}` : 'Active'}
                    </div>

                    <button
                      onClick={() => handleStopMonitor(channel.channel_id, channel.display_name)}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-red-400 hover:text-white bg-red-950/40 hover:bg-red-600 border border-red-900/60 hover:border-red-600 rounded-xl transition-all shadow-md active:scale-95"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      Stop Monitoring
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Channels Table */}
        <div className="space-y-4 pt-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Tv className="w-5 h-5 text-neutral-400" />
            Configured Channels ({watchedChannels.length})
          </h2>

          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/40 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 uppercase font-bold text-[11px]">
                  <tr>
                    <th className="px-5 py-4">Channel</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Current Video ID</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {watchedChannels.map((c) => (
                    <tr key={c._id || c.channel_id} className="hover:bg-neutral-900/60 transition-colors">
                      <td className="px-5 py-4 font-semibold text-white flex items-center gap-3">
                        {c.profile_pic_url ? (
                          <img src={c.profile_pic_url} alt="" className="w-8 h-8 rounded-full object-cover border border-neutral-700" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-400">
                            {c.display_name.charAt(0)}
                          </div>
                        )}
                        <span>{c.display_name}</span>
                      </td>
                      <td className="px-5 py-4">
                        {c.is_live ? (
                          <span className="px-2.5 py-1 text-[10px] font-extrabold text-red-400 bg-red-950/80 border border-red-800/80 rounded-md">LIVE</span>
                        ) : (
                          <span className="px-2.5 py-1 text-[10px] font-medium text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-md">OFFLINE</span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-neutral-400">{c.current_video_id || '—'}</td>
                      <td className="px-5 py-4 text-right">
                        {c.is_live ? (
                          <button
                            onClick={() => handleStopMonitor(c.channel_id, c.display_name)}
                            className="px-3 py-1.5 text-xs font-bold text-red-400 hover:text-white bg-red-950/60 hover:bg-red-600 rounded-lg border border-red-900/60 transition-all"
                          >
                            Stop
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-600 font-medium">Inactive</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {watchedChannels.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-neutral-500">
                        No watched channels configured yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
