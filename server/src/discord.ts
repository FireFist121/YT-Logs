// Discord Webhook Sender — MongoDB-backed persistent queue
// Events are NEVER lost: saved to DB first, sent when Discord allows it.

import { DiscordQueue } from './db';

// Startup validation
if (process.env.DISCORD_TIMEOUT_WEBHOOK) {
  console.log('[Discord] TIMEOUT webhook URL loaded ✓');
} else {
  console.warn('[Discord] WARNING: DISCORD_TIMEOUT_WEBHOOK is not set!');
}
if (process.env.DISCORD_BAN_WEBHOOK) {
  console.log('[Discord] BAN webhook URL loaded ✓');
} else {
  console.warn('[Discord] WARNING: DISCORD_BAN_WEBHOOK is not set!');
}

export interface ModEventPayload {
  type: 'timeout' | 'ban';
  targetChannelId: string;
  targetDisplayName: string;
  targetProfilePicUrl?: string;
  moderatorDisplayName?: string;
  banDurationSeconds?: number;
  timestamp: string;
  proof?: string[];
}

const MAX_RETRIES = 10;
const MIN_SEND_INTERVAL_MS = 2000; // 2s between sends — safely under Discord's 5 req/2s limit

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Save the event to MongoDB first, then trigger the sender loop */
export async function sendDiscordWebhook(event: ModEventPayload) {
  const webhookUrl = event.type === 'timeout'
    ? process.env.DISCORD_TIMEOUT_WEBHOOK
    : process.env.DISCORD_BAN_WEBHOOK;

  if (!webhookUrl) {
    console.warn(`[Discord] No webhook URL for "${event.type}" — skipping.`);
    return;
  }

  const color = event.type === 'timeout' ? 16753920 : 16711680;
  const title = event.type === 'timeout' ? 'User Timed Out' : 'User Banned';
  const durationText = event.banDurationSeconds ? `\n**Duration:** ${event.banDurationSeconds} seconds` : '';

  const payload: any = {
    embeds: [{
      title,
      color,
      description: `**User:** [${event.targetDisplayName}](https://youtube.com/channel/${event.targetChannelId})\n**Moderator:** ${event.moderatorDisplayName || 'Unknown'}${durationText}`,
      thumbnail: (event.targetProfilePicUrl && event.targetProfilePicUrl.length > 0)
        ? { url: event.targetProfilePicUrl }
        : undefined,
      timestamp: event.timestamp,
      footer: { text: 'Made By - FireFist' }
    }]
  };

  if (event.proof && event.proof.length > 0) {
    let proofText = event.proof.map(msg => `• ${msg}`).join('\n');
    if (proofText.length > 1024) proofText = proofText.substring(0, 1021) + '...';
    payload.embeds[0].fields = [{ name: '📝 Recent Messages', value: proofText }];
  }

  const label = `${event.type} for ${event.targetDisplayName}`;

  // Save to MongoDB — survives redeploys and bans
  try {
    await DiscordQueue.create({
      webhook_url: webhookUrl,
      payload,
      label,
      status: 'pending',
      next_retry_at: new Date(),
    });
    console.log(`[Discord] Queued: ${label}`);
  } catch (err: any) {
    console.error('[Discord] Failed to save to queue:', err.message);
  }
}

/** Background loop: runs every 30s, picks up pending items and sends them */
export async function startDiscordQueueWorker() {
  console.log('[Discord] Queue worker started.');
  while (true) {
    await sleep(30000); // check every 30 seconds
    await flushQueue();
  }
}

async function flushQueue() {
  const now = new Date();

  // Fetch all pending items ready to send
  const items = await DiscordQueue.find({
    status: 'pending',
    next_retry_at: { $lte: now },
  }).sort({ created_at: 1 }).limit(10);

  if (items.length === 0) return;

  console.log(`[Discord] Flushing ${items.length} queued notification(s)...`);

  for (const item of items) {
    try {
      const response = await fetch(item.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });

      if (response.status === 429) {
        // Rate limited — read exact Retry-After from Discord
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSec = retryAfterHeader ? parseFloat(retryAfterHeader) : 60;
        // Persist the next retry time in MongoDB — survives redeploys
        const nextRetry = new Date(Date.now() + retryAfterSec * 1000);
        await DiscordQueue.findByIdAndUpdate(item._id, {
          next_retry_at: nextRetry,
          retries: item.retries + 1,
          status: item.retries + 1 >= MAX_RETRIES ? 'failed' : 'pending',
        });
        console.warn(`[Discord] Rate limited for "${item.label}". Next retry at ${nextRetry.toISOString()} (${Math.ceil(retryAfterSec)}s). Discord said: ${retryAfterSec}s`);
        // Stop flushing — all items share the same IP, wait for ban to lift
        break;
      }

      if (!response.ok) {
        const body = await response.text();
        console.error(`[Discord] Failed [${response.status}] for "${item.label}":`, body);
        await DiscordQueue.findByIdAndUpdate(item._id, {
          retries: item.retries + 1,
          status: item.retries + 1 >= MAX_RETRIES ? 'failed' : 'pending',
          next_retry_at: new Date(Date.now() + 60000), // retry in 1 min
        });
      } else {
        // Success!
        await DiscordQueue.findByIdAndUpdate(item._id, { status: 'sent' });
        console.log(`[Discord] ✓ Sent: ${item.label}`);
      }

    } catch (err: any) {
      console.error(`[Discord] Network error for "${item.label}":`, err.message);
      await DiscordQueue.findByIdAndUpdate(item._id, {
        retries: item.retries + 1,
        next_retry_at: new Date(Date.now() + 30000),
      });
    }

    // Minimum spacing between sends
    await sleep(MIN_SEND_INTERVAL_MS);
  }
}
