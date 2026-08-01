import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Play, Square, RefreshCw, Radio, Tv, ShieldCheck, ExternalLink, AlertCircle, Sparkles } from 'lucide-react';

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

export default function ModControlPage() {
  const [streamUrl, setStreamUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [watchedChannels, setWatchedChannels] = useState<WatchedChannel[]>([]);
  const [activeMonitors, setActiveMonitors] = useState<ActiveMonitor[]>([]);

  const fetchStatus = async () => {
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
    } catch (err) {
      console.error('Failed to refresh stream status:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
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
      fetchStatus();
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
      fetchStatus();
    } catch (err: any) {
      toast.error(err.message || 'Failed to stop monitor', { id: toastId });
    }
  };

  const activeLiveChannels = watchedChannels.filter(c => c.is_live);

  return (
    <div className="h-full overflow-y-auto bg-[#050505] p-6 text-white space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-950/40 via-purple-950/20 to-black p-6 border border-red-900/30 shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Radio className="w-48 h-48 text-red-500" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-400 bg-red-950/60 border border-red-800/50 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                Moderator Control Hub
              </span>
              <span className="px-2.5 py-0.5 text-xs text-neutral-400 bg-neutral-900 border border-neutral-800 rounded-full">
                Public Panel
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Stream Monitoring Control Center
            </h1>
            <p className="mt-1 text-sm text-neutral-400 max-w-xl">
              Enter any active YouTube Stream URL or Video ID below to instantly start real-time chat monitoring and moderation logging.
            </p>
          </div>

          <button
            onClick={fetchStatus}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-neutral-300 bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-red-400' : ''}`} />
            Refresh Status
          </button>
        </div>

        {/* System Metric Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-neutral-800/60">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-900/40 border border-neutral-800/40">
            <div className="p-2.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-neutral-400">Currently Live & Monitored</div>
              <div className="text-lg font-bold text-white">{activeMonitors.length} <span className="text-xs font-normal text-neutral-500">streams</span></div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-900/40 border border-neutral-800/40">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-neutral-400">Total Configured Channels</div>
              <div className="text-lg font-bold text-white">{watchedChannels.length} <span className="text-xs font-normal text-neutral-500">channels</span></div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-900/40 border border-neutral-800/40">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-neutral-400">Monitoring Engine</div>
              <div className="text-lg font-bold text-emerald-400 flex items-center gap-1.5">
                Active & Ready
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Start Monitoring Form */}
      <div className="rounded-2xl bg-neutral-900/50 border border-neutral-800 p-6 shadow-xl backdrop-blur-sm">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-red-500" />
          Start Stream Monitoring
        </h2>
        <p className="text-xs text-neutral-400 mb-4">
          Paste a YouTube live stream link or video ID. The engine will extract active chat details and begin capturing moderation logs instantly.
        </p>

        <form onSubmit={handleStartMonitor} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ  or  video_id_here"
              className="w-full pl-4 pr-36 py-3.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500/80 focus:ring-1 focus:ring-red-500/50 transition-all"
            />
            <button
              type="submit"
              disabled={loading || !streamUrl.trim()}
              className="absolute right-2 top-2 bottom-2 px-5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold text-xs rounded-lg transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Start Monitor
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
            <span className="font-semibold text-neutral-500">Supported Formats:</span>
            <code className="px-2 py-0.5 bg-neutral-950 border border-neutral-800 rounded text-red-400">https://youtube.com/watch?v=...</code>
            <code className="px-2 py-0.5 bg-neutral-950 border border-neutral-800 rounded text-red-400">https://youtu.be/...</code>
            <code className="px-2 py-0.5 bg-neutral-950 border border-neutral-800 rounded text-red-400">Direct Video ID</code>
          </div>
        </form>
      </div>

      {/* Active Monitored Streams Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-500" />
            Active Live Monitors ({activeLiveChannels.length})
          </h2>
          <span className="text-xs text-neutral-500">Auto-refreshes every 10 seconds</span>
        </div>

        {activeLiveChannels.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-8 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-500">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-sm font-medium text-neutral-300">No Live Streams Currently Being Monitored</div>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Use the form above to paste a live stream link and start monitoring active chat events.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeLiveChannels.map((channel) => (
              <div
                key={channel._id || channel.channel_id}
                className="group relative rounded-2xl bg-neutral-900/60 border border-neutral-800 p-5 hover:border-neutral-700 transition-all flex flex-col justify-between shadow-xl"
              >
                <div>
                  {/* Channel Header */}
                  <div className="flex items-center gap-3 mb-3">
                    {channel.profile_pic_url ? (
                      <img
                        src={channel.profile_pic_url}
                        alt={channel.display_name}
                        className="w-11 h-11 rounded-full border border-neutral-700 object-cover"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-400 font-bold">
                        {channel.display_name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white truncate">{channel.display_name}</h3>
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-950/80 border border-red-800/80 rounded-md flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                          LIVE
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 truncate">ID: {channel.channel_id}</p>
                    </div>
                  </div>

                  {/* Video Details */}
                  {channel.current_video_id && (
                    <div className="my-3 p-2.5 rounded-xl bg-neutral-950 border border-neutral-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-neutral-300 min-w-0">
                        <Tv className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
                        <span className="truncate font-mono">ID: {channel.current_video_id}</span>
                      </div>
                      <a
                        href={`https://youtube.com/watch?v=${channel.current_video_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-red-400 hover:text-red-300 flex items-center gap-1 text-[11px] font-medium flex-shrink-0 ml-2"
                      >
                        Watch <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="pt-3 border-t border-neutral-800/60 flex items-center justify-between gap-2 mt-2">
                  <div className="text-[11px] text-neutral-500">
                    {channel.last_checked ? `Checked: ${new Date(channel.last_checked).toLocaleTimeString()}` : 'Active'}
                  </div>

                  <button
                    onClick={() => handleStopMonitor(channel.channel_id, channel.display_name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-400 hover:text-white bg-red-950/40 hover:bg-red-600 border border-red-900/50 hover:border-red-600 rounded-lg transition-all active:scale-95"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    Stop Monitoring
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Managed Channels List */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Tv className="w-4 h-4 text-neutral-400" />
          All Configured Channels ({watchedChannels.length})
        </h2>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Current Video ID</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {watchedChannels.map((c) => (
                  <tr key={c._id || c.channel_id} className="hover:bg-neutral-900/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-white flex items-center gap-2.5">
                      {c.profile_pic_url ? (
                        <img src={c.profile_pic_url} alt="" className="w-7 h-7 rounded-full object-cover border border-neutral-700" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-neutral-400">
                          {c.display_name.charAt(0)}
                        </div>
                      )}
                      <span>{c.display_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      {c.is_live ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold text-red-400 bg-red-950/60 border border-red-800/60 rounded">LIVE</span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-medium text-neutral-500 bg-neutral-900 border border-neutral-800 rounded">OFFLINE</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-400">{c.current_video_id || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {c.is_live ? (
                        <button
                          onClick={() => handleStopMonitor(c.channel_id, c.display_name)}
                          className="px-2.5 py-1 text-[11px] font-medium text-red-400 hover:text-white bg-red-950/50 hover:bg-red-600 rounded border border-red-900 transition-all"
                        >
                          Stop
                        </button>
                      ) : (
                        <span className="text-[11px] text-neutral-600">Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
                {watchedChannels.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
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
  );
}
