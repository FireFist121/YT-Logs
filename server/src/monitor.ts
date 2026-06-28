import { youtube } from './youtube';
import { sendDiscordWebhook } from './discord';
import { ModEvent, BannedUser } from './db';

interface MonitorState {
  liveChatId: string;
  channelId: string;
  videoId?: string;
  pageToken?: string;
  pollIntervalMs: number;
  processedEventIds: Set<string>;
  recentMessages: Map<string, string[]>;
  timer: NodeJS.Timeout | null;
  isFirstPoll: boolean;
}

const activeMonitors = new Map<string, MonitorState>();

export function getActiveMonitors() {
  return Array.from(activeMonitors.values()).map(state => ({
    liveChatId: state.liveChatId,
    channelId: state.channelId,
    videoId: state.videoId
  }));
}

export async function startMonitor(channelId: string, liveChatId: string, videoId?: string) {
  if (activeMonitors.has(liveChatId)) return;

  const state: MonitorState = {
    liveChatId,
    channelId,
    videoId,
    pollIntervalMs: 45000,
    processedEventIds: new Set(),
    recentMessages: new Map(),
    timer: null,
    isFirstPoll: true,
  };

  activeMonitors.set(liveChatId, state);
  console.log(`Started monitoring chat ${liveChatId} for channel ${channelId}`);
  
  await pollChat(liveChatId);
}

export function stopMonitor(liveChatId: string) {
  const state = activeMonitors.get(liveChatId);
  if (state && state.timer) {
    clearTimeout(state.timer);
  }
  activeMonitors.delete(liveChatId);
  console.log(`Stopped monitoring chat ${liveChatId}`);
}

export function stopMonitorByChannelId(channelId: string) {
  for (const [chatId, state] of activeMonitors.entries()) {
    if (state.channelId === channelId) {
      stopMonitor(chatId);
    }
  }
}

async function pollChat(liveChatId: string) {
  const state = activeMonitors.get(liveChatId);
  if (!state) return;

  try {
    const res = await youtube.liveChatMessages.list({
      liveChatId,
      part: ['snippet', 'authorDetails'],
      pageToken: state.pageToken,
      profileImageSize: 128,
    });

    const data = res.data;
    state.pollIntervalMs = Math.max(data.pollingIntervalMillis || 7000, 45000);
    state.pageToken = data.nextPageToken || undefined;

    const messages = data.items || [];

    for (const msg of messages) {
      if (state.processedEventIds.has(msg.id!)) continue;
      state.processedEventIds.add(msg.id!);

      const { type, publishedAt, userBannedDetails } = msg.snippet as any;
      
      // Track text messages for proof
      if (type === 'textMessageEvent') {
        const authorId = msg.snippet?.authorChannelId || msg.authorDetails?.channelId;
        const text = msg.snippet?.displayMessage;
        if (authorId && text) {
          const current = state.recentMessages.get(authorId) || [];
          state.recentMessages.set(authorId, [...current, text].slice(-4));
        }
      }

      // Handle Mod Events
      if (type === 'userBannedEvent' && userBannedDetails) {
        const isTempBan = userBannedDetails.banType === 'temporary';
        const targetId = userBannedDetails.bannedUserDetails.channelId;
        
        if (!state.isFirstPoll) {
          try {
            await ModEvent.create({
              event_id: msg.id || '',
              stream_video_id: state.channelId,
              event_type: isTempBan ? 'timeout' : 'ban',
              timestamp: new Date(publishedAt),
              target_channel_id: targetId,
              target_display_name: userBannedDetails.bannedUserDetails.displayName,
              target_profile_pic_url: userBannedDetails.bannedUserDetails.profileImageUrl,
              ban_duration_seconds: isTempBan ? parseInt(userBannedDetails.banDurationSeconds, 10) : null,
              recent_messages: state.recentMessages.get(targetId) || [],
            });
          } catch (e: any) {
            if (e.code !== 11000) console.error('ModEvent Insert Error:', e.message);
          }

          // Also update banned users table
          try {
            const existing = await BannedUser.findOne({ channel_id: targetId });
            const isAlreadyPermanent = existing?.ban_type === 'permanent' && existing?.status === 'active';
            const finalBanType = (isTempBan && !isAlreadyPermanent) ? 'temporary' : 'permanent';

            await BannedUser.findOneAndUpdate(
              { channel_id: targetId },
              {
                $set: {
                  display_name: userBannedDetails.bannedUserDetails.displayName,
                  profile_pic_url: userBannedDetails.bannedUserDetails.profileImageUrl,
                  ban_type: finalBanType,
                  ban_duration_seconds: finalBanType === 'temporary' ? parseInt(userBannedDetails.banDurationSeconds, 10) : null,
                  banned_at: new Date(publishedAt),
                  status: 'active',
                  stream_video_id: state.channelId,
                  banned_by_name: msg.authorDetails?.displayName,
                  recent_messages: state.recentMessages.get(targetId) || [],
                  unbanned_at: null,
                  unbanned_by_name: null
                }
              },
              { upsert: true }
            );
          } catch (upsertErr) {
            console.error('Upsert Error:', upsertErr);
          }
          
          await sendDiscordWebhook({
            type: isTempBan ? 'timeout' : 'ban',
            targetChannelId: targetId,
            targetDisplayName: userBannedDetails.bannedUserDetails.displayName,
            targetProfilePicUrl: userBannedDetails.bannedUserDetails.profileImageUrl,
            moderatorDisplayName: msg.authorDetails?.displayName || undefined,
            banDurationSeconds: isTempBan ? parseInt(userBannedDetails.banDurationSeconds, 10) : undefined,
            timestamp: new Date(publishedAt).toISOString(),
            proof: state.recentMessages.get(targetId) || [],
          });

          console.log(`Logged ${isTempBan ? 'timeout' : 'ban'} for ${userBannedDetails.bannedUserDetails.displayName}`);
        }
      }
    }

    state.isFirstPoll = false;

  } catch (err: any) {
    console.error(`Error polling chat ${liveChatId}:`, err.message);
  }

  // Schedule next poll
  state.timer = setTimeout(() => pollChat(liveChatId), state.pollIntervalMs);
}
