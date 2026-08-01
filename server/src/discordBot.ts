import { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { WatchedChannel } from './db';
import { startMonitor, stopMonitorByChannelId, getActiveMonitors } from './monitor';
import { checkChannelLiveStatus } from './watcher';
import { youtube } from './youtube';

let client: Client | null = null;

export function startDiscordBot() {
  if (!process.env.DISCORD_BOT_TOKEN) {
    console.log('[Discord Bot] No DISCORD_BOT_TOKEN found. Bot control panel disabled.');
    return;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
    ],
  });

  client.once('ready', async () => {
    console.log(`[Discord Bot] Logged in as ${client?.user?.tag}! Control panel ready.`);
    
    // Register the slash command globally (might take up to an hour to propagate in all servers, 
    // but usually instant for the bot's home server if refreshed)
    try {
      await client?.application?.commands.create({
        name: 'setup-panel',
        description: 'Creates the YouTube Log Bot Control Panel in this channel.',
        defaultMemberPermissions: '0', // Requires Administrator or specific overrides
      });
      console.log('[Discord Bot] Registered /setup-panel slash command.');
    } catch (err) {
      console.error('[Discord Bot] Failed to register slash command:', err);
    }
  });

  client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand() && interaction.commandName === 'setup-panel') {
      if (!interaction.memberPermissions?.has('Administrator') && !interaction.memberPermissions?.has('ManageGuild')) {
        await interaction.reply({ content: 'You do not have permission to set up the control panel.', flags: [MessageFlags.Ephemeral] });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🛡️ YouTube Log Bot Control Panel')
        .setDescription('Use the buttons below to manually start, stop, or check the status of the YouTube monitoring system.')
        .setColor('#5865F2')
        .addFields(
          { name: '🟢 Turn ON Bot', value: 'Starts monitoring all configured channels.', inline: true },
          { name: '🔴 Turn OFF Bot', value: 'Stops all active monitors.', inline: true },
          { name: '📊 Status', value: 'Checks how many streams are currently being monitored.', inline: false }
        )
        .setFooter({ text: 'YouTube Log Bot • Server Dashboard' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('bot_on')
            .setLabel('Turn ON')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🟢'),
          new ButtonBuilder()
            .setCustomId('bot_off')
            .setLabel('Turn OFF')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔴'),
          new ButtonBuilder()
            .setCustomId('bot_status')
            .setLabel('Status')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📊')
        );

      const textChannel = interaction.channel as import('discord.js').TextChannel;
      await textChannel.send({
        embeds: [embed],
        components: [row]
      });

      await interaction.reply({ content: '✅ Control panel created successfully!', flags: [MessageFlags.Ephemeral] });
      return;
    }

    if (!interaction.isButton()) return;

    // Check permissions (ManageMessages or Admin)
    if (!interaction.memberPermissions?.has('ManageMessages') && !interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({ content: 'You do not have permission to use this panel.', flags: [MessageFlags.Ephemeral] });
      return;
    }

    try {
      if (interaction.customId === 'bot_on') {
        const modal = new ModalBuilder()
          .setCustomId('modal_start_monitor')
          .setTitle('Start Monitoring');

        const urlInput = new TextInputBuilder()
          .setCustomId('stream_url')
          .setLabel("YouTube Stream URL or Video ID")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('https://youtube.com/watch?v=...')
          .setRequired(true);

        const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(urlInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
        return;
      } 
      
      else if (interaction.customId === 'bot_off') {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const channels = await WatchedChannel.find({});
        for (const channel of channels) {
          channel.auto_monitor = false;
          await channel.save();
          stopMonitorByChannelId(channel.channel_id);
        }

        await interaction.editReply(`🔴 Bot turned **OFF** for all channels. Monitoring has been stopped.`);
      }

      else if (interaction.customId === 'bot_status') {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        
        const active = getActiveMonitors();
        const channels = await WatchedChannel.find({});
        const autoMonitoredCount = channels.filter(c => c.auto_monitor).length;

        const embed = new EmbedBuilder()
          .setTitle('📊 System Status')
          .setColor('#2b2d31')
          .addFields(
            { name: 'Total Configured Channels', value: `${channels.length}`, inline: true },
            { name: 'Auto-Monitor ON', value: `${autoMonitoredCount}`, inline: true },
            { name: 'Currently Live & Monitored', value: `${active.length}`, inline: true }
          );

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (err: any) {
      console.error('[Discord Bot] Interaction error:', err);
      if (interaction.deferred) {
        await interaction.editReply(`❌ An error occurred: ${err.message}`);
      } else {
        await interaction.reply({ content: `❌ An error occurred: ${err.message}`, flags: [MessageFlags.Ephemeral] });
      }
    }
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId === 'modal_start_monitor') {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
      const input = interaction.fields.getTextInputValue('stream_url');
      
      let videoId = input;
      try {
        if (input.includes('youtube.com') || input.includes('youtu.be')) {
          const url = new URL(input);
          videoId = url.searchParams.get('v') || url.pathname.split('/').pop() || input;
        }
      } catch (e) {
        // Not a URL, treat as direct ID
      }

      try {
        const videoRes = await youtube.videos.list({
          part: ['snippet', 'liveStreamingDetails'],
          id: [videoId],
        });

        const video = videoRes.data.items?.[0];
        if (!video) {
          await interaction.editReply(`❌ Could not find video with ID: ${videoId}`);
          return;
        }

        const chatId = video.liveStreamingDetails?.activeLiveChatId;
        const channelId = video.snippet?.channelId;

        if (!chatId || !channelId) {
          await interaction.editReply(`❌ This video is not a live stream or chat is disabled.`);
          return;
        }

        // Fetch channel thumbnail for required profile_pic_url field
        let profilePicUrl = '';
        try {
          const channelRes = await youtube.channels.list({
            part: ['snippet'],
            id: [channelId],
          });
          profilePicUrl = channelRes.data.items?.[0]?.snippet?.thumbnails?.default?.url || '';
        } catch (e) {
          // Non-fatal, continue without pic
        }

        // Update live stream info but DO NOT touch auto_monitor — 
        // whatever the website has set should stay as-is.
        // Set last_checked to now so the background watcher skips re-checking
        // this channel immediately (it won't overwrite is_live for 15 min).
        await WatchedChannel.findOneAndUpdate(
          { channel_id: channelId },
          { 
            $set: { 
              is_live: true,
              current_video_id: videoId,
              current_live_chat_id: chatId,
              display_name: video.snippet?.channelTitle || 'Unknown Channel',
              profile_pic_url: profilePicUrl || '',
              last_checked: new Date(),
            },
            $setOnInsert: {
              // Only set these defaults when creating a brand-new document
              auto_monitor: false,
              added_at: new Date(),
            }
          },
          { upsert: true }
        );

        startMonitor(channelId, chatId, videoId);
        await interaction.editReply(`✅ **Successfully started monitoring!**\nChannel: ${video.snippet?.channelTitle}\nVideo ID: ${videoId}`);
        
      } catch (err: any) {
        console.error('[Discord Bot] Modal submit error:', err);
        await interaction.editReply(`❌ Failed to start monitor: ${err.message}`);
      }
    }
  });

  client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
    console.error('[Discord Bot] Failed to login:', err.message);
  });
}
