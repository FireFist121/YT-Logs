import React, { useRef, useEffect } from 'react';
import { Activity, Radio } from 'lucide-react';
import { useMonitorStore } from '../../store/monitorStore';
import ModEventCard from './ModEventCard';

export default function ModEventFeed() {
  const { events, status, totalEventsDetected, clearEvents } = useMonitorStore();
  const topRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top on new events (newest first)
  useEffect(() => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [events.length]);

  const isIdle = status === 'idle' || status === 'loading';

  return (
    <div className="flex flex-col bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e1e1e] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-[#FF0000]" />
          <span className="text-white text-sm font-semibold">Mod Event Feed</span>
          {status === 'active' && (
            <div className="flex items-center gap-1.5 ml-1">
              <Radio size={11} className="text-green-400 animate-pulse" />
              <span className="text-green-400 text-[10px] font-medium">LIVE</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearEvents}
            disabled={events.length === 0}
            className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
              events.length === 0 
                ? 'text-[#444] bg-[#111] border-[#1e1e1e] cursor-not-allowed' 
                : 'text-[#888] hover:text-white bg-[#1a1a1a] hover:bg-[#2a2a2a] border-[#2a2a2a]'
            }`}
          >
            Clear Feed
          </button>
          {totalEventsDetected > 0 && (
            <span className="text-[10px] text-[#666] bg-[#1a1a1a] px-2.5 py-1 rounded-full border border-[#2a2a2a]">
              {totalEventsDetected} total
            </span>
          )}
        </div>
      </div>

      {/* Feed content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0 scrollbar-thin scrollbar-thumb-[#2a2a2a] scrollbar-track-transparent">
        <div ref={topRef} />

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
            {isIdle ? (
              <>
                <div className="w-16 h-16 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mb-4">
                  <Activity size={28} className="text-[#333]" />
                </div>
                <p className="text-[#555] text-sm font-medium mb-1">No stream active</p>
                <p className="text-[#444] text-xs max-w-xs leading-relaxed">
                  Enter a YouTube live stream URL above and click Start to begin monitoring moderator actions.
                </p>
              </>
            ) : status === 'active' ? (
              <>
                <div className="w-16 h-16 rounded-full bg-[#1a1a1a] border border-green-500/20 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(34,197,94,0.1)]">
                  <Radio size={28} className="text-green-400 animate-pulse" />
                </div>
                <p className="text-[#555] text-sm font-medium mb-1">Monitoring active</p>
                <p className="text-[#444] text-xs max-w-xs leading-relaxed">
                  Waiting for moderator actions. Bans, timeouts, and message deletions will appear here.
                </p>
              </>
            ) : null}
          </div>
        ) : (
          events.map((event) => (
            <ModEventCard key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  );
}
