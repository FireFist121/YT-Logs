import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, RefreshCcw, Download, Database,
  ChevronUp, ChevronDown, ChevronsUpDown, AlertCircle, Loader2,
  Trash2, ExternalLink
} from 'lucide-react';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { getChannelDetails } from '../../lib/youtube';
import { useAuthStore } from '../../store/authStore';
import BannedUserRow from './BannedUserRow';
import toast from 'react-hot-toast';
import type { BannedUser } from '../../lib/db';
import { fetchBannedUsers, clearDatabase, syncBannedUsers } from '../../lib/db';

type SortField = 'displayName' | 'banType' | 'bannedAt' | 'status';
type SortDir = 'asc' | 'desc';
type FilterStatus = 'all' | 'active' | 'unbanned';
type FilterBanType = 'all' | 'permanent' | 'temporary';
type GroupBy = 'none' | 'month' | 'stream';
type ActiveTab = 'bans' | 'timeouts';

export default function BannedUsersTable() {
  const { accessToken } = useAuthStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>('bans');
  const [search, setSearch] = useState('');
  const [filterBanType, setFilterBanType] = useState<FilterBanType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortField, setSortField] = useState<SortField>('bannedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [allUsers, setAllUsers] = useState<BannedUser[] | undefined>(undefined);

  useEffect(() => {
    // Initial fetch
    fetchBannedUsers().then(setAllUsers);

    // Poll for changes every 5 seconds instead of websockets
    const interval = setInterval(() => {
      fetchBannedUsers().then(setAllUsers);
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Derived counts for tabs
  const permanentCount = allUsers?.filter((u) => u.banType === 'permanent').length ?? 0;
  const temporaryCount = allUsers?.filter((u) => u.banType === 'temporary').length ?? 0;

  const filtered = useMemo(() => {
    if (!allUsers) return [];
    const tabType = activeTab === 'bans' ? 'permanent' : 'temporary';
    return allUsers
      .filter((u) => u.banType === tabType)
      .filter((u) => {
        if (filterStatus !== 'all' && u.status !== filterStatus) return false;
        const bannedDate = new Date(u.bannedAt);
        if (dateFrom && bannedDate < new Date(dateFrom)) return false;
        if (dateTo && bannedDate > new Date(dateTo + 'T23:59:59')) return false;
        if (search) {
          const s = search.toLowerCase();
          return (
            u.displayName.toLowerCase().includes(s) ||
            u.channelId.toLowerCase().includes(s) ||
            (u.currentDisplayName ?? '').toLowerCase().includes(s)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case 'displayName':
            cmp = (a.currentDisplayName ?? a.displayName).localeCompare(b.currentDisplayName ?? b.displayName);
            break;
          case 'banType':
            cmp = a.banType.localeCompare(b.banType);
            break;
          case 'bannedAt':
            cmp = new Date(a.bannedAt).getTime() - new Date(b.bannedAt).getTime();
            break;
          case 'status':
            cmp = a.status.localeCompare(b.status);
            break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [allUsers, search, filterStatus, sortField, sortDir, activeTab, dateFrom, dateTo]);

  const changesCount = allUsers?.filter(
    (u) => u.hasNameChange || u.hasPicChange || u.channelDeleted
  ).length ?? 0;

  const groupedData = useMemo(() => {
    if (groupBy === 'none') return null;
    
    const groups: Record<string, BannedUser[]> = {};
    for (const u of filtered) {
      let key = 'Unknown';
      if (groupBy === 'month') {
        key = format(new Date(u.bannedAt), 'MMMM yyyy');
      } else if (groupBy === 'stream') {
        key = u.streamVideoId || 'Unknown Stream';
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(u);
    }
    return groups;
  }, [filtered, groupBy]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown size={12} className="text-[#444]" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-[#FF0000]" />
      : <ChevronDown size={12} className="text-[#FF0000]" />;
  };

  const handleClearDatabase = async () => {
    if (window.confirm("Are you sure you want to PERMANENTLY delete all historical logs? This cannot be undone.")) {
      try {
        await clearDatabase();
        setAllUsers([]);
        toast.success("Database cleared successfully.", {
          style: { background: '#1a1a1a', color: '#fff', border: '1px solid #22c55e' }
        });
      } catch (err: any) {
        toast.error("Failed to clear database: " + err.message);
      }
    }
  };

  const handleRefreshChanges = async (specificChannelIds?: string[]) => {
    if (!accessToken) {
      toast.error('Not authenticated.');
      return;
    }
    if (!allUsers || allUsers.length === 0) {
      toast('No users in database to check.', {
        style: { background: '#1a1a1a', color: '#fff' },
      });
      return;
    }

    const usersToCheck = specificChannelIds
      ? allUsers.filter((u) => specificChannelIds.includes(u.channelId))
      : allUsers;

    if (usersToCheck.length === 0) return;

    setIsRefreshing(true);
    const toastId = toast.loading(`Checking ${usersToCheck.length} profile${usersToCheck.length > 1 ? 's' : ''}…`, {
      style: { background: '#1a1a1a', color: '#fff' },
    });

    try {
      const channelIds = usersToCheck.map((u) => u.channelId);
      const channelDetails = await getChannelDetails(channelIds, accessToken);
      const channelMap = new Map(channelDetails.map((c) => [c.id, c]));

      let changesFound = 0;

      const updates = [];
      const logs = [];

      for (const user of usersToCheck) {
        const channel = channelMap.get(user.channelId);
        const userUpdate: any = { channel_id: user.channelId, last_checked: new Date() };

        if (!channel) {
          if (!user.channelDeleted) {
            userUpdate.channel_deleted = true;
            logs.push({
              channel_id: user.channelId,
              changed_at: new Date(),
              type: 'deleted',
              old_value: user.displayName,
              new_value: '',
            });
            changesFound++;
          }
        } else {
          const newName = channel.snippet?.title ?? '';
          const newPic = channel.snippet?.thumbnails?.default?.url ?? '';
          const storedName = user.currentDisplayName ?? user.displayName;
          const storedPic = user.currentProfilePicUrl ?? user.profilePicUrl;

          // Normalize names before comparing: trim, collapse spaces, normalize unicode
          // This prevents false positives from Live Chat API vs Channel API formatting differences
          const normalizeName = (name: string) =>
            name.trim().replace(/\s+/g, ' ').normalize('NFC').toLowerCase();

          if (newName && normalizeName(newName) !== normalizeName(storedName)) {
            // Name genuinely changed
            userUpdate.current_display_name = newName;
            userUpdate.has_name_change = true;
            logs.push({
              channel_id: user.channelId,
              changed_at: new Date(),
              type: 'name',
              old_value: storedName,
              new_value: newName,
            });
            changesFound++;
          } else if (newName && user.hasNameChange) {
            // Names now match — clear the false-positive flag
            userUpdate.has_name_change = false;
            userUpdate.current_display_name = null;
          }

          let isPicDifferent = false;
          if (newPic && storedPic) {
            try {
              const newPath = new URL(newPic).pathname.split('=')[0];
              const storedPath = new URL(storedPic).pathname.split('=')[0];
              isPicDifferent = newPath !== storedPath;
            } catch {
              isPicDifferent = newPic !== storedPic;
            }
          } else if (newPic && !storedPic) {
            isPicDifferent = true;
          }

          if (isPicDifferent) {
            userUpdate.current_profile_pic_url = newPic;
            userUpdate.has_pic_change = true;
            logs.push({
              channel_id: user.channelId,
              changed_at: new Date(),
              type: 'picture',
              old_value: storedPic,
              new_value: newPic,
            });
            changesFound++;
          } else if (newPic && user.hasPicChange) {
            // Pic now matches — clear the false-positive flag
            userUpdate.has_pic_change = false;
            userUpdate.current_profile_pic_url = null;
          }
        }

        updates.push(userUpdate);
      }

      await syncBannedUsers({ updates, logs });

      toast.dismiss(toastId);
      if (changesFound > 0) {
        toast.success(`Found ${changesFound} profile change${changesFound > 1 ? 's' : ''}!`, {
          style: { background: '#1a1a1a', color: '#fff', border: '1px solid #f59e0b' },
          duration: 5000,
        });
      } else {
        toast.success('No profile changes detected.', {
          style: { background: '#1a1a1a', color: '#fff', border: '1px solid #22c55e' },
        });
      }
    } catch (err: unknown) {
      toast.dismiss(toastId);
      const error = err as Error;
      toast.error(`Refresh failed: ${error.message}`, {
        style: { background: '#1a1a1a', color: '#fff' },
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportCSV = () => {
    if (!allUsers || allUsers.length === 0) {
      toast('Nothing to export.', { style: { background: '#1a1a1a', color: '#fff' } });
      return;
    }

    const csvData = allUsers.map((u) => ({
      'Channel ID': u.channelId,
      'Display Name (at ban)': u.displayName,
      'Current Display Name': u.currentDisplayName ?? '',
      'Profile Pic URL': u.profilePicUrl,
      'Ban Type': u.banType,
      'Duration (seconds)': u.banDurationSeconds ?? '',
      'Moderator': u.moderatorDisplayName ?? '',
      'Banned At': format(new Date(u.bannedAt), 'yyyy-MM-dd HH:mm:ss'),
      'Status': u.status,
      'Stream Video ID': u.streamVideoId,
      'Name Changed': u.hasNameChange ? 'Yes' : 'No',
      'Pic Changed': u.hasPicChange ? 'Yes' : 'No',
      'Channel Deleted': u.channelDeleted ? 'Yes' : 'No',
      'Last Checked': u.lastChecked ? format(new Date(u.lastChecked), 'yyyy-MM-dd HH:mm:ss') : '',
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yt-banned-users-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('CSV exported!', {
      style: { background: '#1a1a1a', color: '#fff', border: '1px solid #22c55e' },
    });
  };

  const columns: { field: SortField; label: string }[] = [
    { field: 'displayName', label: 'User' },
    { field: 'banType', label: 'Ban Type' },
    { field: 'bannedAt', label: 'Date' },
    { field: 'status', label: 'Status' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── TABS & TOP ACTIONS ── */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-1 bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('bans')}
            className={`px-4 py-2 font-medium text-sm flex items-center gap-2 rounded-lg transition-all ${
              activeTab === 'bans'
                ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                : 'text-[#555] hover:text-white'
            }`}
          >
            Bans
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              activeTab === 'bans' ? 'bg-red-500/20 text-red-400' : 'bg-[#1e1e1e] text-[#555]'
            }`}>
              {permanentCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('timeouts')}
            className={`px-4 py-2 font-medium text-sm flex items-center gap-2 rounded-lg transition-all ${
              activeTab === 'timeouts'
                ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25'
                : 'text-[#555] hover:text-white'
            }`}
          >
            Timeouts
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              activeTab === 'timeouts' ? 'bg-orange-500/20 text-orange-400' : 'bg-[#1e1e1e] text-[#555]'
            }`}>
              {temporaryCount}
            </span>
          </button>
        </div>

        <button
          onClick={() => handleRefreshChanges()}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
        >
          {isRefreshing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCcw size={14} />
          )}
          Check All Profiles
          {changesCount > 0 && (
            <span className="bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {changesCount}
            </span>
          )}
        </button>
      </div>

      {/* ── TOOLBAR ── */}

      <div className="flex flex-wrap gap-3 mb-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input
            type="text"
            placeholder="Search by name or channel ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#111] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#FF0000]/40 focus:ring-1 focus:ring-[#FF0000]/20 transition-all"
          />
        </div>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          className="bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF0000]/40 cursor-pointer"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="unbanned">Unbanned</option>
        </select>

        {/* Group By filter */}
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          className="bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF0000]/40 cursor-pointer"
        >
          <option value="none">No Grouping</option>
          <option value="month">Group by Month</option>
          <option value="stream">Group by Stream</option>
        </select>

        {/* Date From */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="From date"
          className="bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF0000]/40 cursor-pointer [color-scheme:dark]"
        />

        {/* Date To */}
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title="To date"
          className="bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF0000]/40 cursor-pointer [color-scheme:dark]"
        />

        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-xs text-[#555] hover:text-white transition-colors px-2"
          >
            Clear dates
          </button>
        )}

        {/* Actions */}
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-[#888] hover:text-white rounded-xl text-sm font-medium transition-all"
        >
          <Download size={14} />
          Export CSV
        </button>

        <button
          onClick={handleClearDatabase}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium transition-all ml-auto"
        >
          <Trash2 size={14} />
          Clear Database
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-3 px-1">
        <div className="flex items-center gap-1.5 text-[#666] text-xs">
          <Database size={11} />
          <span>{activeTab === 'bans' ? permanentCount : temporaryCount} total {activeTab === 'bans' ? 'bans' : 'timeouts'}</span>
        </div>
        <span className="text-[#333]">|</span>
        <span className="text-xs text-[#555]">
          {filtered.length} shown
        </span>
        {changesCount > 0 && (
          <>
            <span className="text-[#333]">|</span>
            <span className="text-xs text-amber-400 flex items-center gap-1">
              <AlertCircle size={11} />
              {changesCount} with profile changes
            </span>
          </>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#0d0d0d] border-b border-[#1e1e1e]">
                {columns.map(({ field, label }) => (
                  <th
                    key={field}
                    className="px-4 py-3 text-left text-[10px] font-semibold text-[#555] uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none"
                    onClick={() => handleSort(field)}
                  >
                    <div className="flex items-center gap-1.5">
                      {label}
                      <SortIcon field={field} />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#555] uppercase tracking-wider">
                  Changes
                </th>
                <th className="px-4 py-3 w-32" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Database size={32} className="text-[#2a2a2a] mb-4" />
                      <p className="text-[#555] text-sm font-medium mb-1">
                        {allUsers?.length === 0 ? 'No banned users yet' : 'No results match your filters'}
                      </p>
                      <p className="text-[#444] text-xs">
                        {allUsers?.length === 0
                          ? 'Start monitoring a live stream to detect and record bans.'
                          : 'Try adjusting your search or filter criteria.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : groupedData ? (
                Object.entries(groupedData).map(([groupName, users]) => (
                  <React.Fragment key={groupName}>
                    <tr className="bg-[#1a1a1a] border-y border-[#2a2a2a]">
                      <td colSpan={6} className="px-4 py-2 text-xs font-bold text-white uppercase tracking-wider">
                        {groupBy === 'stream' && groupName !== 'Unknown Stream' ? (
                          <div className="flex items-center gap-2">
                            <span>Stream ID: {groupName}</span>
                            <a 
                              href={`https://youtube.com/watch?v=${groupName}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-[#888] hover:text-[#FF0000] transition-colors"
                              title="Open Stream in YouTube"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        ) : (
                          groupName
                        )}
                      </td>
                    </tr>
                    {users.map((user) => (
                      <BannedUserRow key={user.id} user={user} onRefresh={() => handleRefreshChanges([user.channelId])} />
                    ))}
                  </React.Fragment>
                ))
              ) : (
                filtered.map((user) => (
                  <BannedUserRow key={user.id} user={user} onRefresh={() => handleRefreshChanges([user.channelId])} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
