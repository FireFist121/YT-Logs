import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB, BannedUser, ModEvent, WatchedChannel, ChangeLog } from './db';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

import { startChannelWatcher } from './watcher';
import { startMonitor, stopMonitor, getActiveMonitors } from './monitor';
import { authRouter } from './auth';

app.use('/api/auth', authRouter);

app.get('/api/monitor/status', (req, res) => {
  res.json({ activeMonitors: getActiveMonitors() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/monitor/start', (req, res) => {
  const { channelId, liveChatId, videoId } = req.body;
  if (!channelId || !liveChatId) return res.status(400).json({ error: 'Missing params' });
  startMonitor(channelId, liveChatId, videoId);
  res.json({ success: true });
});

app.post('/api/monitor/stop', (req, res) => {
  const { liveChatId } = req.body;
  if (!liveChatId) return res.status(400).json({ error: 'Missing params' });
  stopMonitor(liveChatId);
  res.json({ success: true });
});

// REST API
app.get('/api/banned-users', async (req, res) => {
  const users = await BannedUser.find().sort({ banned_at: -1 });
  res.json(users);
});

app.put('/api/banned-users/:id/unban', async (req, res) => {
  const user = await BannedUser.findByIdAndUpdate(req.params.id, { status: 'unbanned' }, { new: true });
  if (user) {
    await ChangeLog.create({
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
    await ChangeLog.insertMany(logs);
  }
  if (updates && updates.length > 0) {
    for (const update of updates) {
      await BannedUser.findOneAndUpdate(
        { channel_id: update.channel_id },
        { $set: update }
      );
    }
  }
  res.json({ success: true });
});

app.get('/api/mod-events', async (req, res) => {
  const events = await ModEvent.find().sort({ timestamp: -1 }).limit(100);
  res.json(events);
});

app.get('/api/watched-channels', async (req, res) => {
  const channels = await WatchedChannel.find();
  res.json(channels);
});

app.post('/api/watched-channels', async (req, res) => {
  const channel = await WatchedChannel.findOneAndUpdate(
    { channel_id: req.body.channel_id },
    req.body,
    { upsert: true, new: true }
  );
  res.json(channel);
});

app.delete('/api/watched-channels/:channelId', async (req, res) => {
  await WatchedChannel.deleteOne({ channel_id: req.params.channelId });
  res.json({ success: true });
});

app.post('/api/watched-channels/:channelId/toggle', async (req, res) => {
  const channel = await WatchedChannel.findOne({ channel_id: req.params.channelId });
  if (channel) {
    channel.auto_monitor = !channel.auto_monitor;
    await channel.save();
  }
  res.json({ success: true, channel });
});

app.put('/api/watched-channels/:channelId/status', async (req, res) => {
  const channel = await WatchedChannel.findOneAndUpdate(
    { channel_id: req.params.channelId },
    { $set: req.body },
    { new: true }
  );
  res.json({ success: true, channel });
});

app.get('/api/change-logs/:channelId', async (req, res) => {
  const logs = await ChangeLog.find({ channel_id: req.params.channelId }).sort({ changed_at: -1 });
  res.json(logs);
});

app.delete('/api/clear-database', async (req, res) => {
  await BannedUser.deleteMany({});
  await ModEvent.deleteMany({});
  await ChangeLog.deleteMany({});
  res.json({ success: true });
});

import path from 'path';
const clientBuildPath = path.join(__dirname, '../../dist');
app.use(express.static(clientBuildPath));

app.use((req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Start background processes
connectDB().then(() => {
  startChannelWatcher();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
