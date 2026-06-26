// Using native fetch API

const DISCORD_TIMEOUT_WEBHOOK = process.env.DISCORD_TIMEOUT_WEBHOOK || '';
const DISCORD_BAN_WEBHOOK = process.env.DISCORD_BAN_WEBHOOK || '';

interface ModEventPayload {
  type: 'timeout' | 'ban';
  targetDisplayName: string;
  targetProfilePicUrl?: string;
  moderatorDisplayName?: string;
  banDurationSeconds?: number;
  timestamp: string;
  proof?: string[];
}

export async function sendDiscordWebhook(event: ModEventPayload) {
  const webhookUrl = event.type === 'timeout' ? DISCORD_TIMEOUT_WEBHOOK : DISCORD_BAN_WEBHOOK;
  if (!webhookUrl) return;

  const color = event.type === 'timeout' ? 16753920 : 16711680; // Orange or Red
  const title = event.type === 'timeout' ? 'User Timed Out' : 'User Banned';
  const durationText = event.banDurationSeconds ? `\n**Duration:** ${event.banDurationSeconds} seconds` : '';

  const payload: any = {
    embeds: [{
      title,
      color,
      description: `**User:** ${event.targetDisplayName}\n**Moderator:** ${event.moderatorDisplayName || 'Unknown'}${durationText}`,
      thumbnail: event.targetProfilePicUrl ? { url: event.targetProfilePicUrl } : undefined,
      timestamp: event.timestamp,
      footer: { text: 'Made By - FireFist' }
    }]
  };

  if (event.proof && event.proof.length > 0) {
    payload.embeds[0].fields = [
      {
        name: '📝 Proof (Recent Messages)',
        value: event.proof.map(msg => `• ${msg}`).join('\n')
      }
    ];
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err: any) {
    console.error('Failed to send Discord webhook:', err.message);
  }
}
