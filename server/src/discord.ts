// Discord Webhook Sender — rate-limit-aware queue with per-URL cooldown tracking

// Startup validation — log whether webhook URLs are configured
if (process.env.DISCORD_TIMEOUT_WEBHOOK) {
  console.log('[Discord] TIMEOUT webhook URL loaded ✓');
} else {
  console.warn('[Discord] WARNING: DISCORD_TIMEOUT_WEBHOOK is not set! Timeout events will NOT be sent to Discord.');
}
if (process.env.DISCORD_BAN_WEBHOOK) {
  console.log('[Discord] BAN webhook URL loaded ✓');
} else {
  console.warn('[Discord] WARNING: DISCORD_BAN_WEBHOOK is not set! Ban events will NOT be sent to Discord.');
}

interface ModEventPayload {
  type: 'timeout' | 'ban';
  targetChannelId: string;
  targetDisplayName: string;
  targetProfilePicUrl?: string;
  moderatorDisplayName?: string;
  banDurationSeconds?: number;
  timestamp: string;
  proof?: string[];
}

interface QueueItem {
  webhookUrl: string;
  payload: object;
  label: string;
}

// Per-webhook-URL state
const queues = new Map<string, QueueItem[]>();
const processing = new Set<string>();

// Track when each webhook URL is safe to use again (rate limit cooldown)
const rateLimitedUntil = new Map<string, number>();

const MIN_SEND_INTERVAL_MS = 1500; // min gap between sends (under Discord's 5 req/2s limit)
const MAX_RETRY_WAIT_MS = 10 * 60 * 1000; // respect up to 10 minutes of Retry-After

function enqueue(item: QueueItem) {
  const key = item.webhookUrl;
  if (!queues.has(key)) queues.set(key, []);
  queues.get(key)!.push(item);
  processQueue(key);
}

async function processQueue(key: string) {
  if (processing.has(key)) return;
  processing.add(key);

  while (true) {
    const queue = queues.get(key);
    if (!queue || queue.length === 0) break;

    // Respect active rate limit cooldown — wait it out fully before sending
    const cooldownUntil = rateLimitedUntil.get(key) || 0;
    const now = Date.now();
    if (cooldownUntil > now) {
      const waitMs = cooldownUntil - now;
      console.log(`[Discord] Waiting ${Math.ceil(waitMs / 1000)}s for rate limit cooldown before sending "${queue[0].label}"...`);
      await sleep(waitMs);
    }

    const item = queue[0];

    try {
      const response = await fetch(item.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterMs = retryAfterHeader
          ? Math.ceil(parseFloat(retryAfterHeader) * 1000)
          : 10000;

        // Cap to MAX_RETRY_WAIT_MS so we don't wait forever, but still respect long bans
        const waitMs = Math.min(retryAfterMs, MAX_RETRY_WAIT_MS);

        // Store the cooldown so we don't attempt ANY sends on this URL until it's safe
        rateLimitedUntil.set(key, Date.now() + waitMs);

        console.warn(
          `[Discord] Rate limited (429) for "${item.label}". ` +
          `Cooling down for ${Math.ceil(waitMs / 1000)}s ` +
          `(Discord asked for ${Math.ceil(retryAfterMs / 1000)}s).`
        );

        // Don't shift — retry this item after cooldown expires (loop continues)
        continue;
      }

      // Clear any cooldown on success
      rateLimitedUntil.delete(key);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Discord] Webhook failed [${response.status} ${response.statusText}] for "${item.label}":`, errorBody);
      } else {
        console.log(`[Discord] ✓ Sent successfully: ${item.label}`);
      }

      queue.shift(); // done with this item

      // Minimum spacing between sends to stay under Discord's rate limit
      if (queue.length > 0) await sleep(MIN_SEND_INTERVAL_MS);

    } catch (err: any) {
      console.error(`[Discord] Network error for "${item.label}":`, err.message);
      await sleep(5000); // wait 5s on network error before retry
    }
  }

  processing.delete(key);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function sendDiscordWebhook(event: ModEventPayload) {
  const webhookUrl = event.type === 'timeout'
    ? process.env.DISCORD_TIMEOUT_WEBHOOK
    : process.env.DISCORD_BAN_WEBHOOK;

  if (!webhookUrl) {
    console.warn(`[Discord] No webhook URL for event type "${event.type}" — skipping.`);
    return;
  }

  const color = event.type === 'timeout' ? 16753920 : 16711680; // Orange or Red
  const title = event.type === 'timeout' ? 'User Timed Out' : 'User Banned';
  const durationText = event.banDurationSeconds ? `\n**Duration:** ${event.banDurationSeconds} seconds` : '';

  const payload: any = {
    embeds: [{
      title,
      color,
      description: `**User:** [${event.targetDisplayName}](https://youtube.com/channel/${event.targetChannelId})\n**Moderator:** ${event.moderatorDisplayName || 'Unknown'}${durationText}`,
      thumbnail: (event.targetProfilePicUrl && event.targetProfilePicUrl.length > 0) ? { url: event.targetProfilePicUrl } : undefined,
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
  enqueue({ webhookUrl, payload, label });
}
