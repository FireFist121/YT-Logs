import React, { useState, useEffect } from 'react';
import { X, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fetchChangeLogs, type ChangeLogEntry } from '../../lib/db';

interface ChangeHistoryModalProps {
  channelId: string;
  displayName: string;
  onClose: () => void;
}

const typeLabels: Record<string, { label: string; color: string }> = {
  name: { label: 'Name Changed', color: 'text-amber-400' },
  picture: { label: 'Picture Changed', color: 'text-blue-400' },
  deleted: { label: 'Channel Deleted', color: 'text-red-400' },
  unbanned: { label: 'Unbanned', color: 'text-green-400' },
};

export default function ChangeHistoryModal({ channelId, displayName, onClose }: ChangeHistoryModalProps) {
  const [logs, setLogs] = useState<ChangeLogEntry[] | undefined>(undefined);

  useEffect(() => {
    fetchChangeLogs(channelId).then(setLogs);
  }, [channelId]);

  return (
    <tr>
      <td colSpan={6} className="p-0">
        {/* Overlay */}
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
          <div
            className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e]">
              <div>
                <h3 className="text-white text-sm font-semibold">Change History</h3>
                <p className="text-[#666] text-xs mt-0.5">{displayName}</p>
              </div>
              <button
                onClick={onClose}
                className="text-[#666] hover:text-white transition-colors p-1.5 hover:bg-[#2a2a2a] rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            {/* Timeline */}
            <div className="p-5 max-h-96 overflow-y-auto space-y-3">
              {!logs || logs.length === 0 ? (
                <div className="text-center py-8">
                  <Clock size={24} className="text-[#333] mx-auto mb-2" />
                  <p className="text-[#555] text-sm">No change history yet</p>
                  <p className="text-[#444] text-xs mt-1">
                    Click "Refresh & Check Changes" to detect profile updates.
                  </p>
                </div>
              ) : (
                logs.map((log) => {
                  const cfg = typeLabels[log.type] ?? { label: log.type, color: 'text-[#888]' };
                  return (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-[#FF0000] flex-shrink-0 mt-1" />
                        <div className="w-px flex-1 bg-[#2a2a2a] mt-1" />
                      </div>
                      <div className="pb-3 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                          <span className="text-[10px] text-[#555]">
                            {format(new Date(log.changedAt), 'MMM d, yyyy HH:mm')}
                          </span>
                        </div>
                        {log.type !== 'deleted' && log.type !== 'unbanned' && (
                          <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg p-2.5 text-xs space-y-1">
                            <div className="flex items-start gap-2">
                              <span className="text-[#666] w-12 flex-shrink-0">Before:</span>
                              <span className="text-[#888] break-all">{log.oldValue || '—'}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-[#666] w-12 flex-shrink-0">After:</span>
                              <span className="text-white break-all">{log.newValue || '—'}</span>
                            </div>
                          </div>
                        )}
                        {log.type === 'deleted' && (
                          <p className="text-red-400/70 text-xs">Channel no longer found in YouTube API.</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
