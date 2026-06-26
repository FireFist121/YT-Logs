import { Router } from 'express';
import { oauth2Client } from './youtube';
import fs from 'fs';
import path from 'path';

export const authRouter = Router();

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
      
      // Save it to .env so it persists across server restarts
      const envPath = path.resolve(process.cwd(), '.env');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      if (envContent.includes('YOUTUBE_REFRESH_TOKEN=')) {
        envContent = envContent.replace(/YOUTUBE_REFRESH_TOKEN=.*/g, `YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
      } else {
        envContent += `\nYOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
      }
      fs.writeFileSync(envPath, envContent);
      console.log('Refresh token saved to server/.env!');
    }

    // Redirect back to the frontend app
    res.redirect('http://localhost:5173/');
  } catch (error: any) {
    console.error('Error retrieving access token', error);
    res.status(500).send('Authentication failed: ' + error.message);
  }
});
