import { WatchedChannel, ChangeLog } from './db';
import { startMonitor, stopMonitorByChannelId } from './monitor';
import { youtube } from './youtube';

const WATCH_INTERVAL_MS = 15 * 60 * 1000;

export function startChannelWatcher() {
  console.log('Starting channel watcher service...');
  checkAll();
  setInterval(checkAll, WATCH_INTERVAL_MS);
}

async function checkAll() {
  try {
    const watchedChannels = await WatchedChannel.find({});
    if (!watchedChannels) return;

    for (const channel of watchedChannels) {
      try {
        if (!channel.auto_monitor) {
          continue; // Completely skip querying YouTube if auto-monitor is off
        }

        const liveStatus = await checkChannelLiveStatus(channel.channel_id);

        await WatchedChannel.updateOne(
          { channel_id: channel.channel_id },
          {
            $set: {
              is_live: liveStatus.isLive,
              current_video_id: liveStatus.videoId,
              current_live_chat_id: liveStatus.liveChatId,
              last_checked: new Date(),
            }
          }
        );

        if (liveStatus.isLive && liveStatus.liveChatId) {
          startMonitor(channel.channel_id, liveStatus.liveChatId, liveStatus.videoId || undefined);
        } else if (!liveStatus.isLive) {
          // Stream ended, stop monitoring automatically
          stopMonitorByChannelId(channel.channel_id);
        }
      } catch (err: any) {
        console.warn(`Failed to check channel ${channel.display_name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Channel watcher error:', err);
  }
}

async function checkChannelLiveStatus(channelId: string) {
  // 1. FAST INSTANT CHECK FOR AUTHENTICATED USER'S OWN STREAM
  try {
    const res = await youtube.liveBroadcasts.list({
      part: ['snippet'],
      broadcastStatus: 'active',
      broadcastType: 'all',
    });
    
    if (res.data.items && res.data.items.length > 0) {
      const activeBroadcast = res.data.items.find((b: any) => b.snippet.channelId === channelId);
      if (activeBroadcast) {
        // Find live chat ID
        const videoRes = await youtube.videos.list({
          part: ['liveStreamingDetails'],
          id: [activeBroadcast.id!],
        });
        const chatId = videoRes.data.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
        
        return {
          isLive: true,
          videoId: activeBroadcast.id,
          liveChatId: chatId,
        };
      }
    }
  } catch (err) {
    // Ignore error
  }

  // 2. SEARCH.LIST
  try {
    const res = await youtube.search.list({
      part: ['snippet'],
      channelId,
      eventType: 'live',
      type: ['video'],
    });

    if (res.data.items && res.data.items.length > 0) {
      const videoId = res.data.items[0].id?.videoId;
      if (videoId) {
        const videoRes = await youtube.videos.list({
          part: ['liveStreamingDetails'],
          id: [videoId],
        });
        const chatId = videoRes.data.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
        
        return {
          isLive: !!chatId,
          videoId,
          liveChatId: chatId,
        };
      }
    }
  } catch (err: any) {
    throw err;
  }

  return { isLive: false };
}
