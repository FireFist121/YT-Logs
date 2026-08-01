"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveMonitors = getActiveMonitors;
exports.startMonitor = startMonitor;
exports.stopMonitor = stopMonitor;
exports.stopMonitorByChannelId = stopMonitorByChannelId;
const youtube_1 = require("./youtube");
const discord_1 = require("./discord");
const db_1 = require("./db");
const activeMonitors = new Map();
function getActiveMonitors() {
    return Array.from(activeMonitors.values()).map(state => ({
        liveChatId: state.liveChatId,
        channelId: state.channelId,
        videoId: state.videoId
    }));
}
async function startMonitor(channelId, liveChatId, videoId) {
    if (activeMonitors.has(liveChatId))
        return;
    const state = {
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
function stopMonitor(liveChatId) {
    const state = activeMonitors.get(liveChatId);
    if (state && state.timer) {
        clearTimeout(state.timer);
    }
    activeMonitors.delete(liveChatId);
    console.log(`Stopped monitoring chat ${liveChatId}`);
}
function stopMonitorByChannelId(channelId) {
    for (const [chatId, state] of activeMonitors.entries()) {
        if (state.channelId === channelId) {
            stopMonitor(chatId);
        }
    }
}
async function pollChat(liveChatId) {
    const state = activeMonitors.get(liveChatId);
    if (!state)
        return;
    try {
        const res = await youtube_1.youtube.liveChatMessages.list({
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
            if (state.processedEventIds.has(msg.id))
                continue;
            state.processedEventIds.add(msg.id);
            const { type, publishedAt, userBannedDetails } = msg.snippet;
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
                        await db_1.ModEvent.create({
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
                    }
                    catch (e) {
                        if (e.code !== 11000)
                            console.error('ModEvent Insert Error:', e.message);
                    }
                    // Also update banned users table
                    try {
                        const existing = await db_1.BannedUser.findOne({ channel_id: targetId });
                        const isAlreadyPermanent = existing?.ban_type === 'permanent' && existing?.status === 'active';
                        const finalBanType = (isTempBan && !isAlreadyPermanent) ? 'temporary' : 'permanent';
                        await db_1.BannedUser.findOneAndUpdate({ channel_id: targetId }, {
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
                        }, { upsert: true });
                    }
                    catch (upsertErr) {
                        console.error('Upsert Error:', upsertErr);
                    }
                    await (0, discord_1.sendDiscordWebhook)({
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
    }
    catch (err) {
        console.error(`Error polling chat ${liveChatId}:`, err.message);
    }
    // Schedule next poll
    state.timer = setTimeout(() => pollChat(liveChatId), state.pollIntervalMs);
}
