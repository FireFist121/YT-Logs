"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
exports.loadRefreshTokenFromDB = loadRefreshTokenFromDB;
const express_1 = require("express");
const youtube_1 = require("./youtube");
const db_1 = require("./db");
exports.authRouter = (0, express_1.Router)();
// Load refresh token from MongoDB into oauth2Client
async function loadRefreshTokenFromDB() {
    try {
        const setting = await db_1.AppSettings.findOne({ key: 'youtube_refresh_token' });
        if (setting?.value) {
            youtube_1.oauth2Client.setCredentials({ refresh_token: setting.value });
            console.log('Loaded refresh token from MongoDB.');
            return true;
        }
    }
    catch (err) {
        console.error('Failed to load refresh token from DB:', err);
    }
    // Fallback to env variable if nothing in DB
    if (process.env.YOUTUBE_REFRESH_TOKEN) {
        youtube_1.oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
        console.log('Loaded refresh token from environment variable.');
        return true;
    }
    console.warn('No refresh token found in DB or environment. Please log in via /api/auth/url');
    return false;
}
exports.authRouter.get('/status', async (req, res) => {
    const setting = await db_1.AppSettings.findOne({ key: 'youtube_refresh_token' });
    const hasToken = !!(setting?.value || process.env.YOUTUBE_REFRESH_TOKEN);
    res.json({ isConfigured: hasToken });
});
// Route to generate the Google OAuth URL
exports.authRouter.get('/url', (req, res) => {
    const url = youtube_1.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent', // Force consent to guarantee we get a refresh_token
        scope: [
            'https://www.googleapis.com/auth/youtube.readonly',
            'https://www.googleapis.com/auth/youtube.force-ssl',
        ],
    });
    res.redirect(url);
});
// OAuth Callback from Google — saves token to MongoDB automatically
exports.authRouter.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
        return res.status(400).send('Missing code parameter');
    }
    try {
        const { tokens } = await youtube_1.oauth2Client.getToken(code);
        youtube_1.oauth2Client.setCredentials(tokens);
        if (tokens.refresh_token) {
            // Save to MongoDB so server never needs manual env update again
            await db_1.AppSettings.findOneAndUpdate({ key: 'youtube_refresh_token' }, { key: 'youtube_refresh_token', value: tokens.refresh_token, updated_at: new Date() }, { upsert: true, new: true });
            console.log('Refresh token saved to MongoDB successfully!');
            return res.send(`
        <html>
        <head><title>Authorization Successful</title></head>
        <body style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #fff;">
          <h1 style="color: #22c55e;">✅ Authorization Successful!</h1>
          <p style="color: #aaa;">Your refresh token has been <strong style="color:#22c55e;">automatically saved to the database</strong>.</p>
          <p style="color: #aaa;">You do <strong>NOT</strong> need to copy anything or update Render. The server will use this token automatically, even after restarts.</p>
          <p style="margin-top: 30px;"><a href="/" style="background:#22c55e; color:#000; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">← Go Back to Dashboard</a></p>
        </body>
        </html>
      `);
        }
        res.send('Authorization successful! However, no new refresh token was provided (Google only sends it the first time). If you need a new one, go to your <a href="https://myaccount.google.com/permissions">Google Account permissions</a>, remove access for this app, and try again.');
    }
    catch (error) {
        console.error('Error during auth callback:', error);
        res.status(500).send('Authentication failed: ' + error.message);
    }
});
