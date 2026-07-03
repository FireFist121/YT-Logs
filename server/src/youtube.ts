import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

const redirectUri = process.env.NODE_ENV === 'production' 
  ? (process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/api/auth/callback` : 'https://yt-logs-1.onrender.com/api/auth/callback')
  : 'http://localhost:3001/api/auth/callback';

export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  redirectUri
);

// Token is loaded from MongoDB at startup via loadRefreshTokenFromDB() in auth.ts
export const youtube = google.youtube({
  version: 'v3',
  auth: oauth2Client,
});
