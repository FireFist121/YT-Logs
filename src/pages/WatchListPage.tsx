import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Radio, Clock, RefreshCcw, ExternalLink,
  Copy, ToggleLeft, ToggleRight, AlertCircle, Loader2,
  Tv2, Info
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { fetchWatchedChannels, upsertWatchedChannel, removeWatchedChannel, updateWatchedChannelLiveStatus, type WatchedChannel } from '../lib/db';
import { resolveChannel, checkChannelLiveStatus, parseVideoId, getLiveChatId } from '../lib/youtube';
import { useAuthStore } from '../store/authStore';
import { useMonitorStore } from '../store/monitorStore';
import { isQuotaExhausted } from '../lib/quota';

export default function WatchListPage() {
  const { accessToken } = useAuthStore();
  const { status: monitorStatus, setVideoId, setLiveChatId, setStatus } = useMonitorStore();

  const [inputValue, setInputValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const [watchedChannels, setWatchedChannels] = useState<WatchedChannel[] | undefined>(undefined);

  useEffect(() => {
    fetchWatchedChannels().then(setWatchedChannels);

    const interval = setInterval(() => {
      fetchWatchedChannels().then(setWatchedChannels);
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const liveCount = watchedChannels?.filter((c) => c.isLive).length ?? 0;

  const handleAdd = async () => {
    if (!inputValue.trim() || !accessToken) return;
    setIsAdding(true);
    setAddError(null);

    try {
      const resolved = await resolveChannel(inputValue.trim(), accessToken);

      // Check if already watching
      const existing = watchedChannels?.find(c => c.channelId === resolved.channelId);
      if (existing) {
        setAddError('This channel is already in your watch list.');
        return;
      }

      await upsertWatchedChannel({
        channelId: resolved.channelId,
        displayName: resolved.displayName,
        profilePicUrl: resolved.profilePicUrl,
        handle: resolved.handle,
        addedAt: new Date(),
        isLive: false,
        autoMonitor: true,
        lastChecked: undefined,
      });

      setInputValue('');
      toast.success(`Added ${resolved.displayName} to watch list!`, {
        style: { background: '#1a1a1a', color: '#fff', border: '1px solid #22c55e' },
      });

      // Immediately check their live status
      checkOneLive(resolved.channelId, resolved.displayName);
    } catch (err: unknown) {
      const error = err as Error;
      setAddError(error.message);
    } finally {
      setIsAdding(false);
    }
  };

  const checkOneLive = async (channelId: string, displayName: string, isManual = false) => {
    if (!accessToken || isQuotaExhausted()) return;
    setRefreshingId(channelId);
    try {
      const status = await checkChannelLiveStatus(channelId, accessToken, isManual);
      await updateWatchedChannelLiveStatus(channelId, status.isLive, status.videoId, status.liveChatId);
      if (status.isLive) {
        toast(`🔴 ${displayName} is LIVE!`, {
          duration: 8000,
          style: { background: '#1a0000', color: '#fff', border: '1px solid #FF0000' },
        });
      }
    } catch (err: any) {
      if (err.status === 429 || (err.message && err.message.includes('429'))) {
        toast.error(`Search API quota exceeded for today. Please paste your stream URL manually in the Live Monitor tab!`, {
          duration: 6000,
          style: { background: '#1a1a1a', color: '#fff' },
        });
      }
    } finally {
      setRefreshingId(null);
    }
  };

  const handleCheckAll = async () => {
    if (!accessToken || !watchedChannels) return;
    for (const ch of watchedChannels) {
      await checkOneLive(ch.channelId, ch.displayName, true);
    }
    toast('Live status refreshed for all channels.', {
      style: { background: '#1a1a1a', color: '#fff' },
    });
  };

  const handleRemove = async (channelId: string, name: string) => {
    await removeWatchedChannel(channelId);
    toast(`Removed ${name} from watch list.`, {
      style: { background: '#1a1a1a', color: '#fff' },
    });
  };

  const toggleAutoMonitor = async (channelId: string, current: boolean) => {
    try {
      await fetch(`/api/watched-channels/${channelId}/toggle`, { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
    fetchWatchedChannels().then(setWatchedChannels);
  };

  const startMonitoring = async (videoId: string, liveChatId: string) => {
    try {
      await fetch('/api/monitor/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: 'manual', liveChatId })
      });
      setVideoId(videoId);
      setLiveChatId(liveChatId);
      setStatus('active');
      toast.success('Monitoring started on backend!', {
        style: { background: '#1a1a1a', color: '#fff', border: '1px solid #22c55e' },
      });
    } catch (err) {
      toast.error('Failed to connect to backend server.');
    }
  };

  const handleManualUrlMonitor = async (channelId: string, url: string) => {
    if (!url.trim()) return;
    const vId = parseVideoId(url);
    if (!vId) {
      toast.error('Invalid Video ID or URL');
      return;
    }
    try {
      const chatId = await getLiveChatId(vId, accessToken!);
      await updateWatchedChannelLiveStatus(channelId, true, vId, chatId);
      startMonitoring(vId, chatId);
    } catch (e: any) {
      toast.error(e.message || 'Failed to start manual monitor');
    }
  };

  const copyChannelId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast('Channel ID copied!', { style: { background: '#1a1a1a', color: '#fff', fontSize: '12px' }, duration: 2000 });
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-white text-base font-bold flex items-center gap-2">
            <Tv2 size={16} className="text-[#FF0000]" />
            Channel Watch List
            {liveCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {liveCount} LIVE
              </span>
            )}
          </h2>
          <p className="text-[#666] text-xs mt-1">
            Add channels to watch. The app checks every 5 minutes and auto-starts monitoring when they go live.
          </p>
        </div>
        {watchedChannels && watchedChannels.length > 0 && (
          <button
            onClick={handleCheckAll}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-[#888] hover:text-white rounded-xl text-xs font-medium transition-all"
          >
            <RefreshCcw size={13} />
            Check All Now
          </button>
        )}
      </div>

      {/* Quota note */}
      <div className="flex items-start gap-2.5 bg-green-500/5 border border-green-500/20 rounded-xl p-3">
        <Info size={13} className="text-green-400 flex-shrink-0 mt-0.5" />
        <p className="text-green-300/70 text-[11px] leading-relaxed">
          <strong className="text-green-300">Optimized!</strong> Live status checks now bypass the expensive Search API and use only <strong className="text-green-300">1 API unit</strong> per channel per check!
          With the default 10,000 daily quota, you can comfortably watch dozens of channels. Chat monitoring costs 5 units per poll.
        </p>
      </div>

      {/* Add channel input */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-5">
        <p className="text-white text-xs font-semibold mb-3 flex items-center gap-1.5">
          <Plus size={13} className="text-[#FF0000]" />
          Add a Channel to Watch
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setAddError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="youtube.com/@channelname  ·  youtube.com/channel/UC…  ·  @handle  ·  UCxxxxx"
            disabled={isAdding}
            className="
              flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl
              px-4 py-2.5 text-sm text-white placeholder-[#444]
              focus:outline-none focus:border-[#FF0000]/50 focus:ring-1 focus:ring-[#FF0000]/20
              disabled:opacity-40 transition-all
            "
          />
          <button
            onClick={handleAdd}
            disabled={isAdding || !inputValue.trim()}
            className="
              flex items-center gap-2 px-5 py-2.5
              bg-[#FF0000] hover:bg-[#cc0000] text-white
              rounded-xl text-sm font-medium
              shadow-[0_2px_12px_rgba(255,0,0,0.3)] hover:shadow-[0_4px_20px_rgba(255,0,0,0.45)]
              transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none
            "
          >
            {isAdding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {isAdding ? 'Resolving…' : 'Add'}
          </button>
        </div>
        {addError && (
          <div className="mt-2 flex items-center gap-1.5 text-red-400 text-xs">
            <AlertCircle size={12} />
            {addError}
          </div>
        )}
        <p className="text-[#444] text-[10px] mt-2">
          Accepts: full URL, @handle, channel ID (UC…)
        </p>
      </div>

      {/* Channel cards */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
        {!watchedChannels || watchedChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mb-4">
              <Tv2 size={28} className="text-[#333]" />
            </div>
            <p className="text-[#555] text-sm font-medium mb-1">No channels yet</p>
            <p className="text-[#444] text-xs max-w-xs leading-relaxed">
              Add YouTube channels above. When they go live, you'll get a notification and monitoring can start automatically.
            </p>
          </div>
        ) : (
          watchedChannels.map((channel) => (
            <ChannelCard
              key={channel.channelId}
              channel={channel}
              monitorStatus={monitorStatus}
              isRefreshing={refreshingId === channel.channelId}
              onRemove={() => handleRemove(channel.channelId, channel.displayName)}
              onToggleAutoMonitor={() => toggleAutoMonitor(channel.channelId, channel.autoMonitor)}
              onCheckLive={() => checkOneLive(channel.channelId, channel.displayName, true)}
              onManualUrlMonitor={(url) => handleManualUrlMonitor(channel.channelId, url)}
              onStartMonitor={() => {
                if (channel.currentVideoId && channel.currentLiveChatId) {
                  startMonitoring(channel.currentVideoId, channel.currentLiveChatId);
                }
              }}
              onCopyId={() => copyChannelId(channel.channelId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Channel Card ─────────────────────────────────────────────────────────────

interface ChannelCardProps {
  channel: WatchedChannel;
  monitorStatus: string;
  isRefreshing: boolean;
  onRemove: () => void;
  onToggleAutoMonitor: () => void;
  onCheckLive: () => void;
  onStartMonitor: () => void;
  onManualUrlMonitor: (url: string) => void;
  onCopyId: () => void;
}

function ChannelCard({
  channel, monitorStatus, isRefreshing,
  onRemove, onToggleAutoMonitor, onCheckLive, onStartMonitor, onManualUrlMonitor, onCopyId,
}: ChannelCardProps) {
  const [manualUrl, setManualUrl] = useState('');

  return (
    <div
      className={`
        relative bg-[#111] border rounded-2xl p-4 transition-all group
        ${channel.isLive
          ? 'border-[#FF0000]/40 shadow-[0_0_20px_rgba(255,0,0,0.1)]'
          : 'border-[#1e1e1e] hover:border-[#2a2a2a]'
        }
      `}
    >
      {/* Live glow pulse */}
      {channel.isLive && (
        <div className="absolute inset-0 rounded-2xl bg-[#FF0000]/3 pointer-events-none animate-pulse" />
      )}

      <div className="relative flex items-start gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {channel.profilePicUrl ? (
            <img
              src={channel.profilePicUrl}
              alt={channel.displayName}
              className="w-12 h-12 rounded-full object-cover border-2 border-[#2a2a2a]"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.displayName)}&background=1a1a1a&color=888`;
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#1e1e1e] border-2 border-[#2a2a2a] flex items-center justify-center text-[#666] text-lg font-bold">
              {channel.displayName[0]?.toUpperCase()}
            </div>
          )}

          {channel.isLive && (
            <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-5 h-5 bg-[#FF0000] rounded-full border-2 border-[#111]">
              <Radio size={9} className="text-white animate-pulse" />
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <a
              href={`https://youtube.com/channel/${channel.channelId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white text-sm font-semibold hover:text-[#FF0000] transition-colors flex items-center gap-1"
            >
              {channel.displayName}
              <ExternalLink size={11} className="opacity-50" />
            </a>

            {channel.isLive ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF0000] text-white">
                <Radio size={9} />
                LIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-[#555] px-2 py-0.5 rounded-full bg-[#1a1a1a] border border-[#222]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#333]" />
                Offline
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[#555] text-[10px] font-mono truncate">{channel.channelId}</span>
            <button onClick={onCopyId} className="text-[#444] hover:text-white opacity-0 group-hover:opacity-100 transition-all">
              <Copy size={9} />
            </button>
          </div>

          {/* Live stream info */}
          {channel.isLive && channel.currentVideoId && (
            <div className="flex items-center gap-2 mb-3">
              <a
                href={`https://youtube.com/watch?v=${channel.currentVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#FF0000] hover:underline flex items-center gap-1"
              >
                <Radio size={10} />
                Watch live stream
                <ExternalLink size={9} />
              </a>
            </div>
          )}

          {/* Controls row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Auto-monitor toggle */}
            <button
              onClick={onToggleAutoMonitor}
              className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
                channel.autoMonitor ? 'text-green-400' : 'text-[#555]'
              }`}
              title="Toggle auto-monitoring when this channel goes live"
            >
              {channel.autoMonitor
                ? <ToggleRight size={16} className="text-green-400" />
                : <ToggleLeft size={16} />
              }
              Auto-monitor
            </button>

            <span className="text-[#333]">·</span>

            {/* Manual check */}
            <button
              onClick={onCheckLive}
              disabled={isRefreshing}
              className="flex items-center gap-1 text-[11px] text-[#555] hover:text-white transition-colors disabled:opacity-50"
            >
              {isRefreshing
                ? <Loader2 size={11} className="animate-spin" />
                : <RefreshCcw size={11} />
              }
              Check now
            </button>

            {/* Manual start monitoring */}
            {channel.isLive && channel.currentVideoId && channel.currentLiveChatId ? (
              <>
                <span className="text-[#333]">·</span>
                <button
                  onClick={onStartMonitor}
                  disabled={monitorStatus === 'active'}
                  className="flex items-center gap-1 text-[11px] text-[#FF0000] hover:text-red-300 font-medium transition-colors disabled:opacity-40"
                >
                  <Radio size={11} />
                  {monitorStatus === 'active' ? 'Already monitoring' : 'Monitor now'}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="text"
                  value={manualUrl}
                  onChange={e => setManualUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && onManualUrlMonitor(manualUrl)}
                  placeholder="Paste live URL..."
                  className="bg-[#0a0a0a] border border-[#2a2a2a] rounded w-32 px-2 py-1 text-[10px] text-white placeholder-[#555] focus:outline-none focus:border-[#FF0000]/50"
                />
                <button 
                  onClick={() => onManualUrlMonitor(manualUrl)}
                  disabled={!manualUrl.trim() || monitorStatus === 'active'}
                  className="text-[10px] px-2 py-1 bg-[#1a1a1a] hover:bg-[#FF0000] text-[#888] hover:text-white rounded border border-[#2a2a2a] hover:border-[#FF0000] transition-colors disabled:opacity-50"
                >
                  Start
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right side — last checked + remove */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {channel.lastChecked && (
            <div className="flex items-center gap-1 text-[#444] text-[9px]">
              <Clock size={9} />
              <span>Checked {formatDistanceToNow(new Date(channel.lastChecked), { addSuffix: true })}</span>
            </div>
          )}
          <button
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 text-[#555] hover:text-red-400 transition-all p-1 rounded-lg hover:bg-red-500/10"
            title="Remove from watch list"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
