// ─── YouTube Data API v3 Client ───────────────────────────────────────────────

import { consumeQuota } from './quota';

const BASE = 'https://www.googleapis.com/youtube/v3';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiveChatMessageSnippet {
  type: string;
  liveChatId: string;
  authorChannelId: string;
  publishedAt: string;
  hasDisplayContent: boolean;
  displayMessage?: string;
  messageDeletedDetails?: { deletedMessageId: string };
  userBannedDetails?: {
    bannedUserDetails: {
      channelId: string;
      channelUrl: string;
      displayName: string;
      profileImageUrl: string;
    };
    banType: 'permanent' | 'temporary';
    banDurationSeconds?: string; // API returns as string
  };
}

export interface LiveChatMessage {
  kind: string;
  etag: string;
  id: string;
  snippet: LiveChatMessageSnippet;
  authorDetails?: {
    channelId: string;
    channelUrl: string;
    displayName: string;
    profileImageUrl: string;
    isChatOwner: boolean;
    isChatSponsor: boolean;
    isChatModerator: boolean;
  };
}

export interface LiveChatMessagesResponse {
  kind: string;
  etag: string;
  nextPageToken: string;
  pollingIntervalMillis: number;
  pageInfo: { totalResults: number; resultsPerPage: number };
  items: LiveChatMessage[];
}

export interface ChannelSnippet {
  title: string;
  description: string;
  thumbnails: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
  };
}

export interface Channel {
  kind: string;
  etag: string;
  id: string;
  snippet: ChannelSnippet;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const errMsg = body?.error?.message ?? res.statusText;
    const err: Error & { status?: number } = new Error(errMsg);
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

// ─── Parse Video ID ───────────────────────────────────────────────────────────

export function parseVideoId(input: string): string | null {
  const trimmed = input.trim();
  // Direct 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  // youtu.be/ID
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // youtube.com/watch?v=ID
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  // youtube.com/live/ID
  const liveMatch = trimmed.match(/\/live\/([a-zA-Z0-9_-]{11})/);
  if (liveMatch) return liveMatch[1];

  return null;
}

// ─── Get Live Chat ID ─────────────────────────────────────────────────────────

export async function getLiveChatId(videoId: string, token: string): Promise<string> {
  const url = `${BASE}/videos?part=liveStreamingDetails&id=${encodeURIComponent(videoId)}`;
  consumeQuota(1);
  const data = await apiFetch<{ items: Array<{ liveStreamingDetails?: { activeLiveChatId?: string } }> }>(url, token);

  const chatId = data.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
  if (!chatId) throw new Error('No active live chat found for this video. Make sure the stream is live.');
  return chatId;
}

// ─── Get Live Chat Messages ───────────────────────────────────────────────────

export async function getChatMessages(
  liveChatId: string,
  token: string,
  pageToken?: string
): Promise<LiveChatMessagesResponse> {
  let url = `${BASE}/liveChat/messages?part=snippet,authorDetails&liveChatId=${encodeURIComponent(liveChatId)}&maxResults=2000`;
  if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
  consumeQuota(5);
  return apiFetch<LiveChatMessagesResponse>(url, token);
}

// ─── Get Channel Details (for profile change detection) ───────────────────────

export async function getChannelDetails(channelIds: string[], token: string): Promise<Channel[]> {
  if (channelIds.length === 0) return [];
  // Batch: max 50 IDs per request
  const batches: string[][] = [];
  for (let i = 0; i < channelIds.length; i += 50) {
    batches.push(channelIds.slice(i, i + 50));
  }

  const results: Channel[] = [];
  for (const batch of batches) {
    const ids = batch.map(encodeURIComponent).join(',');
    const url = `${BASE}/channels?part=snippet&id=${ids}`;
    // A single request to channels.list costs EXACTLY 1 quota unit, even if we request 50 IDs at once.
    consumeQuota(1); 
    const data = await apiFetch<{ items: Channel[] }>(url, token);
    results.push(...(data.items ?? []));
  }
  return results;
}

// ─── Get Authenticated User's Channel ────────────────────────────────────────

export async function getMyChannel(token: string): Promise<Channel | null> {
  const url = `${BASE}/channels?part=snippet&mine=true`;
  consumeQuota(1);
  const data = await apiFetch<{ items: Channel[] }>(url, token);
  return data.items?.[0] ?? null;
}

// ─── Detect Mod Events ────────────────────────────────────────────────────────

export type DetectedEventType = 'ban' | 'timeout' | 'messageDeleted' | 'unbanned';

export interface DetectedModEvent {
  id: string;
  type: DetectedEventType;
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

export function extractModEvents(messages: LiveChatMessage[]): DetectedModEvent[] {
  const events: DetectedModEvent[] = [];

  for (const msg of messages) {
    const { type, publishedAt, userBannedDetails, messageDeletedDetails } = msg.snippet;

    if (type === 'userBannedEvent' && userBannedDetails) {
      const isTempBan = userBannedDetails.banType === 'temporary';

      events.push({
        id: msg.id,
        type: isTempBan ? 'timeout' : 'ban',
        timestamp: new Date(publishedAt),
        targetChannelId: userBannedDetails.bannedUserDetails.channelId,
        targetDisplayName: userBannedDetails.bannedUserDetails.displayName,
        targetProfilePicUrl: userBannedDetails.bannedUserDetails.profileImageUrl,
        moderatorChannelId: msg.authorDetails?.channelId,
        moderatorDisplayName: msg.authorDetails?.displayName,
        moderatorProfilePicUrl: msg.authorDetails?.profileImageUrl,
        banDurationSeconds: isTempBan ? parseInt(userBannedDetails.banDurationSeconds!, 10) : undefined,
      });
    } else if (type === 'messageDeletedEvent' && messageDeletedDetails) {
      events.push({
        id: msg.id,
        type: 'messageDeleted',
        timestamp: new Date(publishedAt),
        // For messageDeletedEvent, the authorDetails belong to the moderator who deleted it.
        // We might not know the original message author without caching chat history,
        // so we label the target as 'Unknown User' and put moderator details correctly.
        targetChannelId: 'unknown',
        targetDisplayName: 'Unknown User',
        targetProfilePicUrl: '',
        moderatorChannelId: msg.authorDetails?.channelId,
        moderatorDisplayName: msg.authorDetails?.displayName,
        moderatorProfilePicUrl: msg.authorDetails?.profileImageUrl,
        deletedMessageId: messageDeletedDetails.deletedMessageId,
      });
    }
  }

  return events;
}

// ─── Channel Resolution ───────────────────────────────────────────────────────

export interface ResolvedChannel {
  channelId: string;
  displayName: string;
  profilePicUrl: string;
  handle?: string;
}

/**
 * Parse a YouTube channel URL or identifier into a lookup key.
 * Supports:
 *   - https://youtube.com/channel/UCxxxxxx
 *   - https://youtube.com/@handle
 *   - https://youtube.com/c/customname
 *   - https://youtube.com/user/username
 *   - UCxxxxxx (raw channel ID)
 *   - @handle or handle
 */
export function parseChannelInput(input: string): { type: 'id' | 'handle' | 'username'; value: string } | null {
  const trimmed = input.trim();

  // Raw UC... channel ID
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) {
    return { type: 'id', value: trimmed };
  }

  // youtube.com/channel/UCxxxxxx
  const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);
  if (channelMatch) return { type: 'id', value: channelMatch[1] };

  // youtube.com/@handle
  const handleMatch = trimmed.match(/youtube\.com\/@([a-zA-Z0-9._-]+)/);
  if (handleMatch) return { type: 'handle', value: '@' + handleMatch[1] };

  // youtube.com/user/username
  const userMatch = trimmed.match(/youtube\.com\/user\/([a-zA-Z0-9_-]+)/);
  if (userMatch) return { type: 'username', value: userMatch[1] };

  // youtube.com/c/customname
  const customMatch = trimmed.match(/youtube\.com\/c\/([a-zA-Z0-9_-]+)/);
  if (customMatch) return { type: 'handle', value: customMatch[1] };

  // @handle (raw)
  if (trimmed.startsWith('@')) return { type: 'handle', value: trimmed };

  // Bare word — try as username
  if (/^[a-zA-Z0-9_.-]+$/.test(trimmed)) return { type: 'username', value: trimmed };

  return null;
}

/**
 * Resolve any channel URL/identifier to full channel details.
 */
export async function resolveChannel(input: string, token: string): Promise<ResolvedChannel> {
  const parsed = parseChannelInput(input);
  if (!parsed) throw new Error('Could not parse the channel URL or ID. Try pasting the full YouTube channel URL.');

  let url: string;
  if (parsed.type === 'id') {
    url = `${BASE}/channels?part=snippet&id=${encodeURIComponent(parsed.value)}`;
  } else if (parsed.type === 'handle') {
    url = `${BASE}/channels?part=snippet&forHandle=${encodeURIComponent(parsed.value)}`;
  } else {
    url = `${BASE}/channels?part=snippet&forUsername=${encodeURIComponent(parsed.value)}`;
  }

  consumeQuota(1);
  const data = await apiFetch<{ items?: Channel[] }>(url, token);

  if (!data.items || data.items.length === 0) {
    throw new Error(`Channel not found. Make sure the channel exists and is public.`);
  }

  const ch = data.items[0];
  return {
    channelId: ch.id,
    displayName: ch.snippet.title,
    profilePicUrl: ch.snippet.thumbnails?.default?.url ?? ch.snippet.thumbnails?.medium?.url ?? '',
    handle: parsed.type === 'handle' ? parsed.value : undefined,
  };
}

// ─── Live Status Check ────────────────────────────────────────────────────────

export interface LiveStatus {
  isLive: boolean;
  videoId?: string;
  liveChatId?: string;
  title?: string;
}

/**
 * Check whether a channel is currently live.
 * 
 * We now use a CORS proxy to fetch the HTML of https://youtube.com/channel/ID/live
 * This avoids the official Search API which:
 * 1. Costs 100 quota units per check.
 * 2. Has a massive caching delay (sometimes takes 15+ minutes to show a stream is live).
 * 
 * If the CORS proxy fails, we fallback to the official Search API.
 */
export async function checkChannelLiveStatus(channelId: string, token: string, forceSearchApi: boolean = false): Promise<LiveStatus> {
  // 1. FAST INSTANT CHECK FOR AUTHENTICATED USER'S OWN STREAM
  // The liveBroadcasts API costs only 1 unit and instantly returns active streams for the logged-in user.
  try {
    const broadcastsUrl = `${BASE}/liveBroadcasts?part=snippet&broadcastStatus=active&broadcastType=all`;
    // We don't strictly consume quota here until we fetch, but let's deduct 1
    consumeQuota(1);
    const broadcastData = await apiFetch<{ items?: Array<{ snippet: { channelId: string, title: string, liveChatId?: string }, id: string }> }>(broadcastsUrl, token);
    
    if (broadcastData.items && broadcastData.items.length > 0) {
      // Find a broadcast that matches the channel we are checking
      const activeBroadcast = broadcastData.items.find(b => b.snippet.channelId === channelId);
      if (activeBroadcast) {
        return {
          isLive: true,
          videoId: activeBroadcast.id,
          liveChatId: activeBroadcast.snippet.liveChatId,
          title: activeBroadcast.snippet.title,
        };
      }
    }
  } catch (err) {
    console.warn('[WatchList] liveBroadcasts check failed or not authorized:', err);
  }

  let videoId: string | null = null;
  let title = 'Live Stream';

  // 2. USE SEARCH.LIST (100 Quota)
  try {
    const searchUrl = `${BASE}/search?part=snippet&channelId=${channelId}&eventType=live&type=video`;
    consumeQuota(100);
    const searchData = await apiFetch<{ items?: Array<{ id: { videoId: string }, snippet: { title: string } }> }>(searchUrl, token);
    if (searchData.items && searchData.items.length > 0) {
      videoId = searchData.items[0].id.videoId;
      title = searchData.items[0].snippet.title;
    }
  } catch (err: any) {
    console.warn('[WatchList] search API failed:', err);
    if (err.status === 429 || (err.message && err.message.includes('429')) || (err.message && err.message.includes('quota'))) {
      throw err;
    }
  }

  if (!videoId) {
    return { isLive: false };
  }

  // 4. Verify the video is actually live and get Chat ID
  const url = `${BASE}/videos?part=snippet,liveStreamingDetails&id=${videoId}`;
  consumeQuota(1);

  try {
    const data = await apiFetch<{ items?: Array<{ snippet: { liveBroadcastContent: string, title: string }, liveStreamingDetails?: { activeLiveChatId?: string } }> }>(url, token);
    
    if (!data.items || data.items.length === 0) {
      return { isLive: false };
    }

    const videoInfo = data.items[0];
    
    if (videoInfo.snippet.liveBroadcastContent === 'live') {
      const liveChatId = videoInfo.liveStreamingDetails?.activeLiveChatId;
      return { 
        isLive: true, 
        videoId, 
        liveChatId, 
        title: videoInfo.snippet.title || title 
      };
    }
    
    return { isLive: false };
  } catch (err) {
    console.warn('[WatchList] videos.list check failed:', err);
    return { isLive: false };
  }
}

