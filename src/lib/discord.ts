import type { DetectedModEvent } from './youtube';

export async function sendDiscordWebhook(webhookUrl: string, event: DetectedModEvent) {
  if (!webhookUrl) return;

  const isBan = event.type === 'ban';
  const icon = isBan ? '🚫' : '⏳';
  const actionName = isBan ? 'User Hidden' : 'User Timeout';
  const actionDesc = isBan ? 'Permanently hidden from channel' : `Put in timeout for ${event.banDurationSeconds} seconds`;
  
  let recentMsgs = '';
  if (event.recentMessages && event.recentMessages.length > 0) {
    recentMsgs = '\n\n**Recent messages from user:**\n' + event.recentMessages.map(msg => `• ${msg}`).join('\n');
  } else {
    recentMsgs = '\n\n**Recent messages from user:**\n*No recent messages recorded.*';
  }

  const description = `**User:** ${event.targetDisplayName}\n**Action:** ${actionDesc}\n**Moderator:** ${event.moderatorDisplayName || 'Unknown'}${recentMsgs}`;

  const payload = {
    embeds: [{
      title: `${icon} Moderator Action: ${actionName}`,
      description: description,
      color: isBan ? 0xff0000 : 0xf97316,
      thumbnail: {
        url: event.targetProfilePicUrl
      },
      timestamp: event.timestamp.toISOString(),
      footer: {
        text: 'Made By - FireFist'
      }
    }]
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Failed to send Discord webhook:', error);
  }
}
