"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordQueue = exports.AppSettings = exports.ChangeLog = exports.WatchedChannel = exports.ModEvent = exports.BannedUser = void 0;
exports.connectDB = connectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
async function connectDB() {
    if (!process.env.MONGODB_URI) {
        console.error('Missing MONGODB_URI in .env');
        return;
    }
    try {
        await mongoose_1.default.connect(process.env.MONGODB_URI);
        console.log('Successfully connected to MongoDB');
    }
    catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
}
// Schemas
const bannedUserSchema = new mongoose_1.default.Schema({
    channel_id: { type: String, required: true, unique: true },
    display_name: { type: String, required: true },
    profile_pic_url: { type: String, required: true },
    ban_type: { type: String, enum: ['temporary', 'permanent'], default: 'permanent' },
    ban_duration_seconds: { type: Number, default: null },
    banned_at: { type: Date, required: true },
    status: { type: String, enum: ['active', 'unbanned'], default: 'active' },
    stream_video_id: { type: String },
    banned_by_name: { type: String },
    recent_messages: { type: [String], default: [] },
    unbanned_at: { type: Date },
    unbanned_by_name: { type: String },
    current_display_name: { type: String },
    current_profile_pic_url: { type: String },
    channel_deleted: { type: Boolean, default: false },
    has_name_change: { type: Boolean, default: false },
    has_pic_change: { type: Boolean, default: false },
    last_checked: { type: Date },
});
exports.BannedUser = mongoose_1.default.model('BannedUser', bannedUserSchema);
const modEventSchema = new mongoose_1.default.Schema({
    event_id: { type: String, required: true, unique: true },
    stream_video_id: { type: String, required: true },
    event_type: { type: String, required: true },
    timestamp: { type: Date, required: true },
    target_channel_id: { type: String, required: true },
    target_display_name: { type: String },
    target_profile_pic_url: { type: String },
    ban_duration_seconds: { type: Number },
    deleted_message_id: { type: String },
    recent_messages: { type: [String], default: [] },
});
exports.ModEvent = mongoose_1.default.model('ModEvent', modEventSchema);
const watchedChannelSchema = new mongoose_1.default.Schema({
    channel_id: { type: String, required: true, unique: true },
    display_name: { type: String, required: true },
    profile_pic_url: { type: String, required: true },
    handle: { type: String },
    added_at: { type: Date, default: Date.now },
    is_live: { type: Boolean, default: false },
    current_video_id: { type: String },
    current_live_chat_id: { type: String },
    last_checked: { type: Date },
    auto_monitor: { type: Boolean, default: true },
});
exports.WatchedChannel = mongoose_1.default.model('WatchedChannel', watchedChannelSchema);
const changeLogSchema = new mongoose_1.default.Schema({
    channel_id: { type: String, required: true },
    changed_at: { type: Date, default: Date.now },
    type: { type: String, enum: ['name', 'picture', 'deleted', 'unbanned'], required: true },
    old_value: { type: String, required: true },
    new_value: { type: String, required: true },
});
exports.ChangeLog = mongoose_1.default.model('ChangeLog', changeLogSchema);
const appSettingsSchema = new mongoose_1.default.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
    updated_at: { type: Date, default: Date.now },
});
exports.AppSettings = mongoose_1.default.model('AppSettings', appSettingsSchema);
const discordQueueSchema = new mongoose_1.default.Schema({
    webhook_url: { type: String, required: true },
    payload: { type: mongoose_1.default.Schema.Types.Mixed, required: true },
    label: { type: String, required: true },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    created_at: { type: Date, default: Date.now },
    next_retry_at: { type: Date, default: Date.now },
    retries: { type: Number, default: 0 },
});
exports.DiscordQueue = mongoose_1.default.model('DiscordQueue', discordQueueSchema);
