import React from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { Ban, Clock, Trash2, UserCheck, User, Copy, ExternalLink, MessageSquare } from 'lucide-react';
import type { DetectedModEvent } from '../../lib/youtube';
import toast from 'react-hot-toast';

interface ModEventCardProps {
  event: DetectedModEvent;
}

const eventConfig = {
  ban: {
    label: 'Permanent Ban',
    icon: Ban,
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    iconColor: 'text-red-400',
    badgeBg: 'bg-red-500/20',
    badgeText: 'text-red-400',
    dot: 'bg-red-500',
    glow: 'shadow-[0_0_0_1px_rgba(239,68,68,0.15)]',
  },
  timeout: {
    label: 'Timeout',
    icon: Clock,
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    iconColor: 'text-orange-400',
    badgeBg: 'bg-orange-500/20',
    badgeText: 'text-orange-400',
    dot: 'bg-orange-400',
    glow: 'shadow-[0_0_0_1px_rgba(249,115,22,0.15)]',
  },
  messageDeleted: {
    label: 'Message Deleted',
    icon: Trash2,
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    iconColor: 'text-yellow-400',
    badgeBg: 'bg-yellow-500/20',
    badgeText: 'text-yellow-400',
    dot: 'bg-yellow-400',
    glow: '',
  },
  unbanned: {
    label: 'Unbanned',
    icon: UserCheck,
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    iconColor: 'text-green-400',
    badgeBg: 'bg-green-500/20',
    badgeText: 'text-green-400',
    dot: 'bg-green-400',
    glow: '',
  },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export default function ModEventCard({ event }: ModEventCardProps) {
  const cfg = eventConfig[event.type];
  const Icon = cfg.icon;

  const copyChannelId = () => {
    navigator.clipboard.writeText(event.targetChannelId);
    toast('Channel ID copied!', {
      style: { background: '#1a1a1a', color: '#fff', fontSize: '12px' },
      duration: 2000,
    });
  };

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-xl border glass-panel
        ${cfg.bgColor} ${cfg.borderColor} ${cfg.glow}
        animate-slide-in
        group hover:shadow-lg transition-all duration-300 ease-out hover:-translate-y-0.5
      `}
    >
      {/* Event type icon */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${cfg.bgColor} flex items-center justify-center mt-0.5`}>
        <Icon size={15} className={cfg.iconColor} />
      </div>

      {/* User avatar */}
      <div className="flex-shrink-0 relative">
        {event.targetProfilePicUrl ? (
          <img
            src={event.targetProfilePicUrl}
            alt={event.targetDisplayName}
            className="w-9 h-9 rounded-full object-cover border-2 border-[#2a2a2a]"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-[#1e1e1e] border-2 border-[#2a2a2a] flex items-center justify-center">
            <User size={16} className="text-[#666]" />
          </div>
        )}
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${cfg.dot} border-2 border-[#0a0a0a]`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white text-sm font-semibold truncate">{event.targetDisplayName}</span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badgeText}`}>
            {cfg.label}
          </span>
          {event.moderatorDisplayName && (
            <span className="text-[10px] text-[#888]">
              by <span className="font-semibold text-[#ccc]">{event.moderatorDisplayName}</span>
            </span>
          )}
          {event.type === 'timeout' && event.banDurationSeconds && (
            <span className="text-[10px] text-orange-300 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
              {formatDuration(event.banDurationSeconds)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[#555] text-[10px] font-mono">{event.targetChannelId}</span>
          <button
            onClick={copyChannelId}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[#555] hover:text-white"
            title="Copy Channel ID"
          >
            <Copy size={10} />
          </button>
          <a
            href={`https://youtube.com/channel/${event.targetChannelId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[#555] hover:text-[#FF0000]"
            title="Open channel"
          >
            <ExternalLink size={10} />
          </a>
        </div>

        {event.type === 'messageDeleted' && event.deletedMessageId && (
          <p className="text-[#666] text-[10px] mt-1">
            Message ID: <span className="font-mono">{event.deletedMessageId.slice(0, 20)}…</span>
          </p>
        )}

        {event.recentMessages && event.recentMessages.length > 0 && (
          <div className="mt-3 bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg p-2.5">
            <p className="text-[#888] text-[9px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <MessageSquare size={10} />
              Recent Chat Proof
            </p>
            <ul className="space-y-1">
              {event.recentMessages.map((msg, i) => (
                <li key={i} className="text-[#ccc] text-[11px] leading-relaxed break-words flex items-start gap-1.5">
                  <span className="text-[#444] select-none mt-[2px]">•</span>
                  <span>{msg}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div className="flex-shrink-0 text-right">
        <p className="text-[#666] text-[10px]" title={format(event.timestamp, 'PPpp')}>
          {formatDistanceToNow(event.timestamp, { addSuffix: true })}
        </p>
        <p className="text-[#444] text-[9px] mt-0.5">
          {format(event.timestamp, 'HH:mm:ss')}
        </p>
      </div>
    </div>
  );
}
