// Discord Webhook Sender — rate-limit-aware queue with auto-retry

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
  retries: number;
}

// Separate queues per webhook URL so one channel's rate limit doesn't block the other
const queues = new Map<string, QueueItem[]>();
const processing = new Set<string>();

const MAX_RETRIES = 5;
const MIN_SEND_INTERVAL_MS = 1500; // min gap between sends to stay under Discord's rate limit

function enqueue(item: QueueItem) {
  const key = item.webhookUrl;
  if (!queues.has(key)) queues.set(key, []);
  queues.get(key)!.push(item);
  processQueue(key);
}

async function processQueue(key: string) {
  if (processing.has(key)) return; // already running for this webhook
  processing.add(key);

  while (true) {
    const queue = queues.get(key);
    if (!queue || queue.length === 0) break;

    const item = queue[0];

    try {
      const response = await fetch(item.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });

      if (response.status === 429) {
        // Rate limited — read Retry-After and wait (cap at 30s to avoid long freezes)
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterRaw = retryAfterHeader ? Math.ceil(parseFloat(retryAfterHeader) * 1000) : 5000;
        const retryAfterMs = Math.min(retryAfterRaw, 30000); // never wait more than 30s

        console.warn(`[Discord] Rate limited (429) for "${item.label}". Retrying in ${retryAfterMs}ms... (attempt ${item.retries + 1}/${MAX_RETRIES})`);

        if (item.retries >= MAX_RETRIES) {
          console.error(`[Discord] Dropped event "${item.label}" after ${MAX_RETRIES} retries.`);
          queue.shift(); // give up on this item
        } else {
          item.retries++;
          await sleep(retryAfterMs);
        }
        continue; // retry same item
      }

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Discord] Webhook failed [${response.status} ${response.statusText}] for "${item.label}":`, errorBody);
      } else {
        console.log(`[Discord] ✓ Sent successfully: ${item.label}`);
      }

      queue.shift(); // move to next item

      // Minimum delay between sends to stay under Discord's rate limit
      if (queue.length > 0) await sleep(MIN_SEND_INTERVAL_MS);

    } catch (err: any) {
      console.error(`[Discord] Network error for "${item.label}":`, err.message);
      if (item.retries >= MAX_RETRIES) {
        console.error(`[Discord] Dropped event "${item.label}" after ${MAX_RETRIES} retries.`);
        queue.shift();
      } else {
        item.retries++;
        await sleep(2000); // wait 2s before retry on network error
      }
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

    payload.embeds[0].fields = [
      {
        name: '📝 Recent Messages',
        value: proofText
      }
    ];
  }

  const label = `${event.type} for ${event.targetDisplayName}`;
  enqueue({ webhookUrl, payload, label, retries: 0 });
}
