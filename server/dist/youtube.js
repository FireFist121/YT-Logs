"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.youtube = exports.oauth2Client = void 0;
const googleapis_1 = require("googleapis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const redirectUri = process.env.NODE_ENV === 'production'
    ? (process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/api/auth/callback` : 'https://yt-logs-1.onrender.com/api/auth/callback')
    : 'http://localhost:3001/api/auth/callback';
exports.oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
// Token is loaded from MongoDB at startup via loadRefreshTokenFromDB() in auth.ts
exports.youtube = googleapis_1.google.youtube({
    version: 'v3',
    auth: exports.oauth2Client,
});
