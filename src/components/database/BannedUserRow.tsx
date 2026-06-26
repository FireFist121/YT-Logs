import React, { useState } from 'react';
import { Copy, ExternalLink, ChevronDown, ChevronUp, Ban, Clock, UserCheck, Pencil, Image, Trash2, MessageSquare, RefreshCcw } from 'lucide-react';
import { format } from 'date-fns';
import type { BannedUser } from '../../lib/db';
import { unbanUser } from '../../lib/db';
import toast from 'react-hot-toast';
import ChangeHistoryModal from './ChangeHistoryModal';

interface BannedUserRowProps {
  user: BannedUser;
  onRefresh?: () => void;
}

export default function BannedUserRow({ user, onRefresh }: BannedUserRowProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const hasChanges = user.hasNameChange || user.hasPicChange || user.channelDeleted;

  const copyChannelId = () => {
    navigator.clipboard.writeText(user.channelId);
    toast('Channel ID copied!', {
      style: { background: '#1a1a1a', color: '#fff', fontSize: '12px' },
      duration: 2000,
    });
  };

  const markUnbanned = async () => {
    await unbanUser(user.id!, user.channelId);
    toast('User marked as unbanned.', {
      style: { background: '#1a1a1a', color: '#fff' },
    });
  };

  const displayName = user.currentDisplayName ?? user.displayName;
  const picUrl = user.currentProfilePicUrl ?? user.profilePicUrl;

  return (
    <>
      <tr
        className={`
          border-b border-[#1a1a1a] transition-all duration-300 group
          ${hasChanges ? 'bg-amber-500/5 hover:bg-amber-500/15' : 'hover:bg-white/5'}
          ${user.channelDeleted ? 'opacity-60' : ''}
        `}
      >
        {/* Avatar + Name */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              {picUrl ? (
                <img
                  src={picUrl}
                  alt={displayName}
                  className="w-9 h-9 rounded-full object-cover border-2 border-[#2a2a2a]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1a1a1a&color=888`;
                  }}
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#1e1e1e] border-2 border-[#2a2a2a] flex items-center justify-center text-[#666] text-sm font-bold">
                  {displayName[0]?.toUpperCase()}
                </div>
              )}
              {user.status === 'active' && !user.channelDeleted && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-[#0f0f0f]" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-sm font-medium ${user.channelDeleted ? 'line-through text-[#666]' : 'text-white'}`}>
                  {displayName}
                </span>
                {user.hasNameChange && (
                  <span title={`Was: ${user.displayName}`} className="text-amber-400">
                    <Pencil size={11} />
                  </span>
                )}
                {user.hasPicChange && (
                  <span title="Profile picture changed" className="text-amber-400">
                    <Image size={11} />
                  </span>
                )}
                {user.channelDeleted && (
                  <span title="Channel deleted" className="text-red-400">
                    <Trash2 size={11} />
                  </span>
                )}
              </div>
              {user.hasNameChange && (
                <p className="text-[10px] text-amber-400/70 truncate">
                  was: {user.displayName}
                </p>
              )}
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-[#555] font-mono truncate max-w-[160px]">
                  {user.channelId}
                </span>
                <button
                  onClick={copyChannelId}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[#555] hover:text-white"
                >
                  <Copy size={9} />
                </button>
                <a
                  href={`https://youtube.com/channel/${user.channelId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[#555] hover:text-[#FF0000]"
                >
                  <ExternalLink size={9} />
                </a>
              </div>
            </div>
          </div>
        </td>

        {/* Ban Type */}
        <td className="px-4 py-3">
          {user.banType === 'permanent' ? (
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
                <Ban size={10} />
                Permanent
              </span>
              {user.moderatorDisplayName && (
                <p className="text-[9px] text-[#888] mt-1 ml-0.5">
                  by <span className="font-medium text-[#ccc]">{user.moderatorDisplayName}</span>
                </p>
              )}
            </div>
          ) : (
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25">
                <Clock size={10} />
                Timeout
              </span>
              <div className="mt-1 ml-0.5">
                {user.banDurationSeconds && (
                  <span className="text-[9px] text-[#555]">
                    {user.banDurationSeconds < 3600
                      ? `${Math.floor(user.banDurationSeconds / 60)}m`
                      : `${Math.floor(user.banDurationSeconds / 3600)}h`}
                  </span>
                )}
                {user.moderatorDisplayName && (
                  <span className="text-[9px] text-[#888] ml-2 border-l border-[#333] pl-2">
                    by <span className="font-medium text-[#ccc]">{user.moderatorDisplayName}</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </td>

        {/* Date */}
        <td className="px-4 py-3">
          <p className="text-sm text-[#888]">{format(new Date(user.bannedAt), 'MMM d, yyyy')}</p>
          <p className="text-[10px] text-[#555]">{format(new Date(user.bannedAt), 'HH:mm:ss')}</p>
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          {user.status === 'active' ? (
            user.banType === 'permanent' ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Active Ban
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                Active Timeout
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              <UserCheck size={10} />
              Unbanned
            </span>
          )}
        </td>

        {/* Changes */}
        <td className="px-4 py-3">
          {hasChanges ? (
            <button
              onClick={() => setShowHistory(true)}
              className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 transition-colors"
            >
              <ChevronDown size={10} />
              {[user.hasNameChange && 'Name', user.hasPicChange && 'Pic', user.channelDeleted && 'Deleted']
                .filter(Boolean).join(' · ')}
            </button>
          ) : user.lastChecked ? (
            <span className="text-[10px] text-[#444]">No changes</span>
          ) : (
            <span className="text-[10px] text-[#333]">—</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {onRefresh && (
              <button
                onClick={onRefresh}
                title="Check for profile changes"
                className="text-[10px] p-1.5 rounded-lg border transition-colors flex items-center gap-1 bg-[#1e1e1e] text-[#888] hover:bg-amber-500/10 hover:text-amber-400 border-[#2a2a2a] hover:border-amber-500/30"
              >
                <RefreshCcw size={12} />
              </button>
            )}
            {user.recentMessages && user.recentMessages.length > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title="View recent messages"
                className={`text-[10px] p-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
                  isExpanded 
                    ? 'bg-[#FF0000]/10 text-[#FF0000] border-[#FF0000]/20' 
                    : 'bg-[#1e1e1e] text-[#888] hover:bg-[#2a2a2a] border-[#2a2a2a] hover:text-white'
                }`}
              >
                <MessageSquare size={12} />
                {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            )}
            {user.status === 'active' && (
              <button
                onClick={markUnbanned}
                title="Mark as unbanned"
                className="text-[10px] px-2 py-1 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-colors"
              >
                Unban
              </button>
            )}
          </div>
        </td>
      </tr>

      {isExpanded && user.recentMessages && user.recentMessages.length > 0 && (
        <tr className="bg-[#0a0a0a] border-b border-[#1a1a1a]">
          <td colSpan={6} className="px-4 py-3">
            <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-3 animate-[slideIn_0.2s_ease-out]">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={12} className="text-[#888]" />
                <span className="text-xs font-semibold text-[#aaa]">Recent Messages (Proof)</span>
              </div>
              <ul className="space-y-1.5 pl-2">
                {user.recentMessages.map((msg, i) => (
                  <li key={i} className="text-xs text-[#ddd] flex items-start gap-2">
                    <span className="text-[#444] select-none mt-0.5">•</span>
                    <span className="break-words">{msg}</span>
                  </li>
                ))}
              </ul>
            </div>
          </td>
        </tr>
      )}

      {showHistory && (
        <ChangeHistoryModal channelId={user.channelId} displayName={displayName} onClose={() => setShowHistory(false)} />
      )}
    </>
  );
}
