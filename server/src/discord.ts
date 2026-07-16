// Using native fetch API

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

export async function sendDiscordWebhook(event: ModEventPayload) {
  const webhookUrl = event.type === 'timeout' 
    ? process.env.DISCORD_TIMEOUT_WEBHOOK 
    : process.env.DISCORD_BAN_WEBHOOK;

  if (!webhookUrl) return;

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

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Discord webhook failed [${response.status} ${response.statusText}]:`, errorBody);
    } else {
      console.log(`Discord webhook sent successfully for ${event.type}: ${event.targetDisplayName}`);
    }
  } catch (err: any) {
    console.error('Failed to send Discord webhook (network error):', err.message);
  }
}
