import React, { useState } from 'react';
import { Play, Square, Link, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { parseVideoId, getLiveChatId } from '../../lib/youtube';
import { useAuthStore } from '../../store/authStore';
import { useMonitorStore } from '../../store/monitorStore';
import toast from 'react-hot-toast';

export default function StreamInput() {
  const [inputValue, setInputValue] = useState('');
  const { accessToken } = useAuthStore();
  const { status, liveChatId, setVideoId, setLiveChatId, setStatus, resetMonitor, pollIntervalMs } = useMonitorStore();

  const isActive = status === 'active' || status === 'loading';

  const handleStart = async () => {
    const videoId = parseVideoId(inputValue);
    if (!videoId) {
      toast.error('Invalid YouTube URL or Video ID.', {
        style: { background: '#1a1a1a', color: '#fff', border: '1px solid #ef4444' },
      });
      return;
    }

    setStatus('loading');
    setVideoId(videoId);

    try {
      const chatId = await getLiveChatId(videoId, accessToken!);
      
      await fetch('http://localhost:3001/api/monitor/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: 'manual', liveChatId: chatId, videoId: videoId })
      });

      setLiveChatId(chatId);
      setStatus('active');
      toast.success('✅ Connected to live chat on backend!', {
        style: { background: '#1a1a1a', color: '#fff', border: '1px solid #22c55e' },
      });
    } catch (err: unknown) {
      const error = err as Error;
      setStatus('error', error.message);
      toast.error(error.message, {
        duration: 6000,
        style: { background: '#1a1a1a', color: '#fff', border: '1px solid #ef4444' },
      });
    }
  };

  const handleStop = async () => {
    if (liveChatId) {
      try {
        await fetch('http://localhost:3001/api/monitor/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ liveChatId })
        });
      } catch (e) {}
    }
    resetMonitor();
    toast('Monitoring stopped.', {
      style: { background: '#1a1a1a', color: '#fff' },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isActive) handleStart();
  };

  return (
    <div className="glass-panel rounded-2xl p-5 shadow-2xl relative overflow-hidden">
      {/* Subtle background glow for the input card */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-red-500/10 rounded-full blur-[50px] pointer-events-none" />
      
      <div className="flex items-center gap-2 mb-4 relative z-10">
        <Link size={16} className="text-[#FF0000]" />
        <h2 className="text-white text-sm font-semibold">Stream to Monitor</h2>
        {status === 'active' && (
          <span className="ml-auto text-[10px] text-[#888] flex items-center gap-1 bg-[#0a0a0a] px-2 py-1 rounded-full border border-white/5">
            <Clock size={10} />
            Poll interval: {(pollIntervalMs / 1000).toFixed(0)}s
          </span>
        )}
      </div>

      <div className="flex gap-2 relative z-10">
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste YouTube live URL or Video ID…"
            disabled={isActive}
            className="
              w-full bg-[#0a0a0a]/50 backdrop-blur-md border border-white/10 rounded-xl
              px-4 py-2.5 text-sm text-white placeholder-[#555]
              focus:outline-none focus:border-[#FF0000]/70 focus:ring-2 focus:ring-[#FF0000]/20
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-300
            "
          />
        </div>

        {isActive ? (
          <button
            onClick={handleStop}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#222] border border-[#3a3a3a] text-white rounded-xl text-sm font-medium transition-all"
          >
            <Square size={14} className="fill-current" />
            Stop
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={!inputValue.trim()}
            className="
              flex items-center gap-2 px-4 py-2.5
              bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white
              rounded-xl text-sm font-medium
              shadow-[0_0_15px_rgba(225,29,72,0.4)] hover:shadow-[0_0_25px_rgba(225,29,72,0.6)]
              transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none
            "
          >
            <Play size={14} className="fill-current" />
            Start
          </button>
        )}
      </div>

      {/* Status messages */}
      {status === 'loading' && (
        <div className="mt-3 flex items-center gap-2 text-yellow-400 text-xs">
          <Loader2 size={12} className="animate-spin" />
          Resolving live chat ID…
        </div>
      )}
      {status === 'error' && (
        <div className="mt-3 flex items-center gap-2 text-red-400 text-xs">
          <AlertCircle size={12} />
          {useMonitorStore.getState().errorMessage}
        </div>
      )}
      {status === 'ended' && (
        <div className="mt-3 flex items-center gap-2 text-[#888] text-xs">
          <AlertCircle size={12} />
          Stream ended. Enter a new stream URL to monitor.
        </div>
      )}
      {status === 'quota_exceeded' && (
        <div className="mt-3 flex items-center gap-2 text-orange-400 text-xs">
          <AlertCircle size={12} />
          API quota exceeded. Polling paused until midnight (Pacific Time).
        </div>
      )}
      {status === 'active' && (
        <div className="mt-3 flex items-center gap-2 text-green-400 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          Monitoring live — moderator actions appear below as they occur.
        </div>
      )}
    </div>
  );
}
