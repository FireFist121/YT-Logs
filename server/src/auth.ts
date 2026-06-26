import { Router } from 'express';
import { oauth2Client } from './youtube';
import fs from 'fs';
import path from 'path';

export const authRouter = Router();

authRouter.get('/status', (req, res) => {
  const hasToken = !!process.env.YOUTUBE_REFRESH_TOKEN;
  res.json({ isConfigured: hasToken });
});

// Route to generate the Google OAuth URL
authRouter.get('/url', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // Force consent to guarantee we get a refresh_token
    scope: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.force-ssl',
    ],
  });
  res.redirect(url);
});

// OAuth Callback from Google
authRouter.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing code parameter');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (tokens.refresh_token) {
      console.log('Successfully acquired refresh token!');
      return res.send(`
        <div style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #22c55e;">Authorization successful!</h1>
          <p>Your new Refresh Token is:</p>
          <pre style="background:#1a1a1a; color:#fff; padding:20px; border-radius:8px; overflow-x:auto;">${tokens.refresh_token}</pre>
          <p style="color: #ef4444; font-weight: bold; margin-top: 20px;">
            IMPORTANT: Render filesystems are ephemeral. You MUST copy this token and update the 
            <code>YOUTUBE_REFRESH_TOKEN</code> environment variable in your Render dashboard, then trigger a manual deploy!
          </p>
        </div>
      `);
    }

    res.send('Authorization successful! However, no new refresh token was provided (Google only sends it the first time). If you need a new one, go to your Google Account permissions, remove access for this app, and try again.');
  } catch (error: any) {
    console.error('Error during auth callback:', error);
    res.status(500).send('Authentication failed');
  }
});
