"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const db_1 = require("./db");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const PORT = process.env.PORT || 3001;
const watcher_1 = require("./watcher");
const monitor_1 = require("./monitor");
const auth_1 = require("./auth");
const discord_1 = require("./discord");
const monitor_2 = require("./monitor");
const youtube_1 = require("./youtube");
app.use('/api/auth', auth_1.authRouter);
app.get('/api/monitor/status', (req, res) => {
    res.json({ activeMonitors: (0, monitor_1.getActiveMonitors)() });
});
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.post('/api/monitor/start', (req, res) => {
    const { channelId, liveChatId, videoId } = req.body;
    if (!channelId || !liveChatId)
        return res.status(400).json({ error: 'Missing params' });
    (0, monitor_1.startMonitor)(channelId, liveChatId, videoId);
    res.json({ success: true });
});
app.post('/api/monitor/stop', (req, res) => {
    const { liveChatId } = req.body;
    if (!liveChatId)
        return res.status(400).json({ error: 'Missing params' });
    (0, monitor_1.stopMonitor)(liveChatId);
    res.json({ success: true });
});
// Endpoint for Mod Control Page: Start stream monitor by YouTube URL or Video ID
app.post('/api/public/start-monitor-url', async (req, res) => {
    const { url: input } = req.body;
    if (!input || typeof input !== 'string') {
        return res.status(400).json({ error: 'Please provide a valid YouTube Stream URL or Video ID.' });
    }
    let videoId = input.trim();
    try {
        if (videoId.includes('youtube.com') || videoId.includes('youtu.be')) {
            const parsedUrl = new URL(videoId);
            videoId = parsedUrl.searchParams.get('v') || parsedUrl.pathname.split('/').pop() || videoId;
        }
    }
    catch (e) {
        // Treat as direct video ID
    }
    try {
        const videoRes = await youtube_1.youtube.videos.list({
            part: ['snippet', 'liveStreamingDetails'],
            id: [videoId],
        });
        const video = videoRes.data.items?.[0];
        if (!video) {
            return res.status(404).json({ error: `Could not find YouTube video with ID: ${videoId}` });
        }
        const chatId = video.liveStreamingDetails?.activeLiveChatId;
        const channelId = video.snippet?.channelId;
        if (!chatId || !channelId) {
            return res.status(400).json({ error: 'This video is not currently live or active live chat is disabled.' });
        }
        let profilePicUrl = '';
        try {
            const channelRes = await youtube_1.youtube.channels.list({
                part: ['snippet'],
                id: [channelId],
            });
            profilePicUrl = channelRes.data.items?.[0]?.snippet?.thumbnails?.default?.url || '';
        }
        catch (e) {
            // Non-fatal
        }
        const channelDoc = await db_1.WatchedChannel.findOneAndUpdate({ channel_id: channelId }, {
            $set: {
                is_live: true,
                current_video_id: videoId,
                current_live_chat_id: chatId,
                display_name: video.snippet?.channelTitle || 'Unknown Channel',
                profile_pic_url: profilePicUrl || '',
                last_checked: new Date(),
            },
            $setOnInsert: {
                auto_monitor: false,
                added_at: new Date(),
            }
        }, { upsert: true, new: true });
        (0, monitor_1.startMonitor)(channelId, chatId, videoId);
        res.json({
            success: true,
            message: `Successfully started monitoring ${video.snippet?.channelTitle}`,
            channel: channelDoc,
            videoId,
            chatId,
        });
    }
    catch (err) {
        console.error('Error starting monitor by URL:', err);
        res.status(500).json({ error: err.message || 'Failed to start stream monitor.' });
    }
});
// Endpoint for Mod Control Page: Stop stream monitor by Channel ID
app.post('/api/public/stop-monitor-channel', async (req, res) => {
    const { channelId } = req.body;
    if (!channelId)
        return res.status(400).json({ error: 'Missing channelId' });
    try {
        const channel = await db_1.WatchedChannel.findOne({ channel_id: channelId });
        if (channel) {
            channel.is_live = false;
            await channel.save();
            if (channel.current_live_chat_id) {
                (0, monitor_1.stopMonitor)(channel.current_live_chat_id);
            }
        }
        (0, monitor_2.stopMonitorByChannelId)(channelId);
        res.json({ success: true, message: 'Monitoring stopped.' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// REST API
app.get('/api/banned-users', async (req, res) => {
    const users = await db_1.BannedUser.find().sort({ banned_at: -1 });
    res.json(users);
});
app.put('/api/banned-users/:id/unban', async (req, res) => {
    const user = await db_1.BannedUser.findByIdAndUpdate(req.params.id, { status: 'unbanned' }, { new: true });
    if (user) {
        await db_1.ChangeLog.create({
            channel_id: user.channel_id,
            type: 'unbanned',
            old_value: 'active',
            new_value: 'unbanned'
        });
    }
    res.json({ success: true, user });
});
app.post('/api/banned-users/sync', async (req, res) => {
    const { updates, logs } = req.body;
    if (logs && logs.length > 0) {
        await db_1.ChangeLog.insertMany(logs);
    }
    if (updates && updates.length > 0) {
        for (const update of updates) {
            await db_1.BannedUser.findOneAndUpdate({ channel_id: update.channel_id }, { $set: update });
        }
    }
    res.json({ success: true });
});
app.get('/api/mod-events', async (req, res) => {
    const events = await db_1.ModEvent.find().sort({ timestamp: -1 }).limit(100);
    res.json(events);
});
app.get('/api/watched-channels', async (req, res) => {
    const channels = await db_1.WatchedChannel.find();
    res.json(channels);
});
app.post('/api/watched-channels', async (req, res) => {
    const channel = await db_1.WatchedChannel.findOneAndUpdate({ channel_id: req.body.channel_id }, req.body, { upsert: true, new: true });
    res.json(channel);
});
app.delete('/api/watched-channels/:channelId', async (req, res) => {
    await db_1.WatchedChannel.deleteOne({ channel_id: req.params.channelId });
    res.json({ success: true });
});
app.post('/api/watched-channels/:channelId/toggle', async (req, res) => {
    const channel = await db_1.WatchedChannel.findOne({ channel_id: req.params.channelId });
    if (channel) {
        channel.auto_monitor = !channel.auto_monitor;
        await channel.save();
    }
    res.json({ success: true, channel });
});
app.put('/api/watched-channels/:channelId/status', async (req, res) => {
    const channel = await db_1.WatchedChannel.findOneAndUpdate({ channel_id: req.params.channelId }, { $set: req.body }, { new: true });
    res.json({ success: true, channel });
});
app.get('/api/change-logs/:channelId', async (req, res) => {
    const logs = await db_1.ChangeLog.find({ channel_id: req.params.channelId }).sort({ changed_at: -1 });
    res.json(logs);
});
app.delete('/api/clear-database', async (req, res) => {
    await db_1.BannedUser.deleteMany({});
    await db_1.ModEvent.deleteMany({});
    await db_1.ChangeLog.deleteMany({});
    res.json({ success: true });
});
const clientBuildPath = path_1.default.join(__dirname, '../../dist');
app.use(express_1.default.static(clientBuildPath));
app.use((req, res) => {
    res.sendFile(path_1.default.join(clientBuildPath, 'index.html'));
});
// Start background processes
(0, db_1.connectDB)().then(async () => {
    await (0, auth_1.loadRefreshTokenFromDB)();
    (0, watcher_1.startChannelWatcher)();
    (0, discord_1.startDiscordQueueWorker)(); // flush pending Discord notifications every 30s
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});
