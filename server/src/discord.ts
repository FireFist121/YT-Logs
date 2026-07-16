// Discord Webhook Sender — Batched delivery with MongoDB-backed persistent queue
// Events are NEVER lost: saved to DB first, then batched (up to 10 embeds per request).
// Batching drastically reduces the number of webhook calls → no more rate limits.

import { DiscordQueue } from './db';

// ─── Startup validation ─────────────────────────────────────────────────────
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

// ─── Types ──────────────────────────────────────────────────────────────────
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

// ─── Constants ───────────────────────────────────────────────────────────────
const MAX_RETRIES = 10;
const MAX_EMBEDS_PER_BATCH = 10;   // Discord hard limit: 10 embeds per message
const BATCH_WINDOW_MS = 10_000;    // Collect events for 10 seconds before flushing
const FLUSH_INTERVAL_MS = 10_000;  // Worker polls every 10 seconds
const MIN_SEND_INTERVAL_MS = 1_000; // Gap between consecutive batch requests (safety)

// ─── In-memory cache (buffer) ─────────────────────────────────────────────
// Structure: webhookUrl → array of embed objects waiting to be sent
const embedBuffer = new Map<string, any[]>();

// Track last-flush timestamp per URL to honour BATCH_WINDOW_MS
const lastFlushTime = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Build a Discord embed object from a ModEventPayload */
function buildEmbed(event: ModEventPayload): any {
  const color = event.type === 'timeout' ? 16753920 : 16711680;
  const title = event.type === 'timeout' ? 'User Timed Out' : 'User Banned';
  const durationText = event.banDurationSeconds
    ? `\n**Duration:** ${event.banDurationSeconds} seconds`
    : '';

  const embed: any = {
    title,
    color,
    description:
      `**User:** [${event.targetDisplayName}](https://youtube.com/channel/${event.targetChannelId})\n` +
      `**Moderator:** ${event.moderatorDisplayName || 'Unknown'}${durationText}`,
    thumbnail:
      event.targetProfilePicUrl && event.targetProfilePicUrl.length > 0
        ? { url: event.targetProfilePicUrl }
        : undefined,
    timestamp: event.timestamp,
    footer: { text: 'Made By - FireFist' },
  };

  if (event.proof && event.proof.length > 0) {
    let proofText = event.proof.map(msg => `• ${msg}`).join('\n');
    if (proofText.length > 1024) proofText = proofText.substring(0, 1021) + '...';
    embed.fields = [{ name: '📝 Recent Messages', value: proofText }];
  }

  return embed;
}

/**
 * Queue a moderation event.
 *
 * Flow:
 *  1. Build the embed from the payload.
 *  2. Add the embed to the in-memory buffer for its webhook URL.
 *  3. Persist a single "batch_pending" row to MongoDB so events survive crashes.
 *     (The worker will read these back on startup if the buffer is empty.)
 */
export async function sendDiscordWebhook(event: ModEventPayload) {
  const webhookUrl =
    event.type === 'timeout'
      ? process.env.DISCORD_TIMEOUT_WEBHOOK
      : process.env.DISCORD_BAN_WEBHOOK;

  if (!webhookUrl) {
    console.warn(`[Discord] No webhook URL for "${event.type}" — skipping.`);
    return;
  }

  const embed = buildEmbed(event);
  const label = `${event.type} for ${event.targetDisplayName}`;

  // 1️⃣ Add to in-memory buffer
  if (!embedBuffer.has(webhookUrl)) {
    embedBuffer.set(webhookUrl, []);
  }
  embedBuffer.get(webhookUrl)!.push(embed);
  console.log(`[Discord] Buffered: ${label} (buffer size: ${embedBuffer.get(webhookUrl)!.length})`);

  // 2️⃣ Persist to MongoDB for crash-safety (one row per individual event)
  try {
    await DiscordQueue.create({
      webhook_url: webhookUrl,
      payload: { embeds: [embed] }, // stored individually; batching happens at send time
      label,
      status: 'pending',
      next_retry_at: new Date(),
    });
  } catch (err: any) {
    console.error('[Discord] Failed to persist to queue:', err.message);
  }
}

// ─── Worker ──────────────────────────────────────────────────────────────────

/** Background loop: checks every FLUSH_INTERVAL_MS and flushes ready batches */
export async function startDiscordQueueWorker() {
  console.log('[Discord] Batched queue worker started.');

  // On startup, reload any surviving "pending" items from MongoDB into the buffer.
  // This handles server restarts where the in-memory buffer was lost.
  await rehydrateBufferFromDB();

  while (true) {
    await sleep(FLUSH_INTERVAL_MS);
    await flushQueue();
  }
}

/**
 * On startup: pull all pending MongoDB rows back into the in-memory buffer
 * so they are included in the next flush cycle.
 */
async function rehydrateBufferFromDB() {
  try {
    const pending = await DiscordQueue.find({ status: 'pending' }).sort({ created_at: 1 });
    if (pending.length === 0) return;

    for (const item of pending) {
      const url = item.webhook_url as string;
      const embeds: any[] = (item.payload as any)?.embeds ?? [];
      if (!embedBuffer.has(url)) embedBuffer.set(url, []);
      embedBuffer.get(url)!.push(...embeds);
    }
    console.log(`[Discord] Rehydrated ${pending.length} pending item(s) from MongoDB into buffer.`);
  } catch (err: any) {
    console.error('[Discord] Failed to rehydrate buffer from DB:', err.message);
  }
}

// Track rate limits per URL so we don't block the whole worker loop
const urlNextRetryTime = new Map<string, number>();

/**
 * Core flush function.
 *
 * For each webhook URL that has buffered embeds:
 *  - Take up to MAX_EMBEDS_PER_BATCH embeds.
 *  - Send them in a single Discord webhook POST (batched).
 *  - On success: mark corresponding DB rows as 'sent'.
 *  - On 429: pause and retry at the time Discord specifies.
 *  - On other errors: mark rows for retry after 60 s.
 */
async function flushQueue() {
  const now = Date.now();

  for (const [webhookUrl, buffer] of embedBuffer.entries()) {
    if (buffer.length === 0) continue;

    // Check if this URL is currently rate limited
    const retryTime = urlNextRetryTime.get(webhookUrl) || 0;
    if (now < retryTime) {
      continue; // Skip this URL, it's on a rate-limit cooldown
    }

    // Respect the batch window — don't flush if last flush was too recent,
    // UNLESS the buffer is already full (10 embeds).
    const timeSinceLast = now - (lastFlushTime.get(webhookUrl) ?? 0);
    if (buffer.length < MAX_EMBEDS_PER_BATCH && timeSinceLast < BATCH_WINDOW_MS) {
      continue; // Still collecting — wait for more events or for window to expire
    }

    // Take a batch of up to 10 embeds
    const batch = buffer.splice(0, MAX_EMBEDS_PER_BATCH);
    console.log(`[Discord] Sending batch of ${batch.length} embed(s) to ${webhookUrl.substring(0, 60)}...`);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: batch }),
      });

      if (response.status === 429) {
        // Rate limited — read exact Retry-After from Discord
        let retryAfterSec = 60; // default 60s
        
        // Sometimes Discord sends it in the JSON body
        try {
          const body = await response.json();
          if (body.retry_after != null) retryAfterSec = parseFloat(body.retry_after);
        } catch (e) {
          const retryAfterHeader = response.headers.get('Retry-After');
          if (retryAfterHeader) retryAfterSec = parseFloat(retryAfterHeader);
        }

        buffer.unshift(...batch); // restore batch to front
        embedBuffer.set(webhookUrl, buffer);

        // Block THIS url from flushing until the retry time
        const nextRetryMs = now + (retryAfterSec * 1000);
        urlNextRetryTime.set(webhookUrl, nextRetryMs);

        // Mark all pending DB rows for this URL with the retry timestamp
        const nextRetryDate = new Date(nextRetryMs);
        await DiscordQueue.updateMany(
          { webhook_url: webhookUrl, status: 'pending' },
          {
            $set: { next_retry_at: nextRetryDate },
            $inc: { retries: 1 },
          }
        );
        // If any item has exceeded MAX_RETRIES, mark as failed
        await DiscordQueue.updateMany(
          { webhook_url: webhookUrl, status: 'pending', retries: { $gte: MAX_RETRIES } },
          { $set: { status: 'failed' } }
        );

        console.warn(
          `[Discord] ⚠️  Rate limited! Batch of ${batch.length} restored to buffer. ` +
          `Retry after ${Math.ceil(retryAfterSec)}s (${nextRetryDate.toISOString()}).`
        );

        // DO NOT SLEEP here. We just set urlNextRetryTime so it gets skipped next time.
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        console.error(`[Discord] ❌ Batch failed [${response.status}]:`, body);
        // Restore failed batch to front of buffer for retry
        buffer.unshift(...batch);
        embedBuffer.set(webhookUrl, buffer);

        await DiscordQueue.updateMany(
          { webhook_url: webhookUrl, status: 'pending' },
          {
            $set: { next_retry_at: new Date(Date.now() + 60_000) },
            $inc: { retries: 1 },
          }
        );
        await DiscordQueue.updateMany(
          { webhook_url: webhookUrl, status: 'pending', retries: { $gte: MAX_RETRIES } },
          { $set: { status: 'failed' } }
        );
      } else {
        // ✅ Success — mark DB rows as sent
        console.log(`[Discord] ✅ Batch of ${batch.length} sent successfully.`);
        lastFlushTime.set(webhookUrl, Date.now());

        // Mark the oldest N pending rows for this URL as sent
        const pendingRows = await DiscordQueue.find({ webhook_url: webhookUrl, status: 'pending' })
          .sort({ created_at: 1 })
          .limit(batch.length);
        const ids = pendingRows.map(r => r._id);
        if (ids.length > 0) {
          await DiscordQueue.updateMany({ _id: { $in: ids } }, { $set: { status: 'sent' } });
        }
      }
    } catch (err: any) {
      console.error(`[Discord] Network error sending batch:`, err.message);
      // Restore to buffer for retry
      buffer.unshift(...batch);
      embedBuffer.set(webhookUrl, buffer);
    }

    // Small gap between requests to different webhook URLs (safety margin)
    await sleep(MIN_SEND_INTERVAL_MS);
  }
}
