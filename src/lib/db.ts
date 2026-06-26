const API_BASE = '/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BannedUser {
  id?: string;
  channelId: string;
  displayName: string;
  profilePicUrl: string;
  banType: 'temporary' | 'permanent';
  banDurationSeconds?: number;
  bannedAt: Date;
  status: 'active' | 'unbanned';
  streamVideoId: string;
  bannedByName?: string;
  recentMessages?: string[];
  unbannedAt?: Date;
  unbannedByName?: string;
  
  // Current live state
  currentDisplayName?: string;
  currentProfilePicUrl?: string;
  channelDeleted?: boolean;
  hasNameChange?: boolean;
  hasPicChange?: boolean;
  lastChecked?: Date;
  moderatorDisplayName?: string;
}

export interface ChangeLogEntry {
  id?: string;
  channelId: string;
  changedAt: Date;
  type: 'name' | 'picture' | 'deleted' | 'unbanned';
  oldValue: string;
  newValue: string;
}

export interface WatchedChannel {
  id?: string;
  channelId: string;
  displayName: string;
  profilePicUrl: string;
  handle?: string;
  addedAt: Date;
  isLive: boolean;
  currentVideoId?: string;
  currentLiveChatId?: string;
  lastChecked?: Date;
  autoMonitor: boolean;
}

export interface ModEvent {
  id?: string;
  eventId: string;
  streamVideoId: string;
  eventType: 'ban' | 'timeout';
  timestamp: Date;
  targetChannelId: string;
  targetDisplayName: string;
  targetProfilePicUrl: string;
  moderatorChannelId?: string;
  moderatorDisplayName?: string;
  moderatorProfilePicUrl?: string;
  banDurationSeconds?: number;
  deletedMessageId?: string;
  recentMessages?: string[];
}

// ─── Data Mapping ────────────────────────────────────────────────────────────

export function fromDbUser(row: any): BannedUser {
  return {
    id: row._id,
    channelId: row.channel_id,
    displayName: row.display_name,
    profilePicUrl: row.profile_pic_url,
    banType: row.ban_type || 'permanent',
    banDurationSeconds: row.ban_duration_seconds,
    bannedAt: new Date(row.banned_at),
    status: row.status,
    streamVideoId: row.stream_video_id,
    bannedByName: row.banned_by_name,
    recentMessages: row.recent_messages || [],
    unbannedAt: row.unbanned_at ? new Date(row.unbanned_at) : undefined,
    unbannedByName: row.unbanned_by_name,
    currentDisplayName: row.current_display_name,
    currentProfilePicUrl: row.current_profile_pic_url,
    channelDeleted: row.channel_deleted,
    hasNameChange: row.has_name_change,
    hasPicChange: row.has_pic_change,
    lastChecked: row.last_checked ? new Date(row.last_checked) : undefined,
    moderatorDisplayName: row.moderator_display_name,
  };
}

export function fromDbWatchedChannel(row: any): WatchedChannel {
  return {
    id: row._id,
    channelId: row.channel_id,
    displayName: row.display_name,
    profilePicUrl: row.profile_pic_url,
    handle: row.handle,
    addedAt: new Date(row.added_at),
    isLive: row.is_live,
    currentVideoId: row.current_video_id,
    currentLiveChatId: row.current_live_chat_id,
    lastChecked: row.last_checked ? new Date(row.last_checked) : undefined,
    autoMonitor: row.auto_monitor,
  };
}

// ─── API Functions ───────────────────────────────────────────────────────────

export async function fetchBannedUsers(): Promise<BannedUser[]> {
  try {
    const res = await fetch(`${API_BASE}/banned-users`);
    const data = await res.json();
    return data.map(fromDbUser);
  } catch (err) {
    console.error('Error fetching banned users:', err);
    return [];
  }
}

export async function unbanUser(userId: string, channelId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/banned-users/${userId}/unban`, { method: 'PUT' });
  } catch (err) {
    console.error('Error unbanning user:', err);
  }
}

export async function syncBannedUsers(payload: { updates: any[], logs: any[] }): Promise<void> {
  try {
    await fetch(`${API_BASE}/banned-users/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Error syncing banned users:', err);
  }
}

export async function fetchModEvents(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/mod-events`);
    const data = await res.json();
    return data.map((row: any) => ({
      id: row.event_id,
      type: row.event_type,
      streamVideoId: row.stream_video_id,
      timestamp: new Date(row.timestamp),
      targetChannelId: row.target_channel_id,
      targetDisplayName: row.target_display_name,
      targetProfilePicUrl: row.target_profile_pic_url,
      banDurationSeconds: row.ban_duration_seconds,
      recentMessages: row.recent_messages || [],
    }));
  } catch (err) {
    console.error('Error fetching mod events:', err);
    return [];
  }
}

export async function upsertWatchedChannel(channel: Omit<WatchedChannel, 'id'>): Promise<void> {
  try {
    await fetch(`${API_BASE}/watched-channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: channel.channelId,
        display_name: channel.displayName,
        profile_pic_url: channel.profilePicUrl,
        handle: channel.handle,
        is_live: channel.isLive,
        auto_monitor: channel.autoMonitor,
      })
    });
  } catch (err) {
    console.error('Error upserting watched channel:', err);
  }
}

export async function updateWatchedChannelLiveStatus(
  channelId: string,
  isLive: boolean,
  currentVideoId?: string,
  currentLiveChatId?: string
): Promise<void> {
  try {
    await fetch(`${API_BASE}/watched-channels/${channelId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        is_live: isLive,
        current_video_id: currentVideoId,
        current_live_chat_id: currentLiveChatId,
        last_checked: new Date().toISOString()
      })
    });
  } catch (err) {
    console.error('Error updating live status:', err);
  }
}

export async function removeWatchedChannel(channelId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/watched-channels/${channelId}`, { method: 'DELETE' });
  } catch (err) {
    console.error('Error removing watched channel:', err);
  }
}

export async function fetchWatchedChannels(): Promise<WatchedChannel[]> {
  try {
    const res = await fetch(`${API_BASE}/watched-channels`);
    const data = await res.json();
    return data.map(fromDbWatchedChannel);
  } catch (err) {
    console.error('Error fetching watched channels:', err);
    return [];
  }
}

export async function fetchChangeLogs(channelId: string): Promise<ChangeLogEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/change-logs/${channelId}`);
    const data = await res.json();
    return data.map((row: any) => ({
      id: row._id,
      channelId: row.channel_id,
      changedAt: new Date(row.changed_at),
      type: row.type,
      oldValue: row.old_value,
      newValue: row.new_value,
    }));
  } catch (err) {
    console.error('Error fetching change logs:', err);
    return [];
  }
}

export async function clearDatabase(): Promise<void> {
  try {
    await fetch(`${API_BASE}/clear-database`, { method: 'DELETE' });
  } catch (err) {
    console.error('Error clearing database:', err);
  }
}
