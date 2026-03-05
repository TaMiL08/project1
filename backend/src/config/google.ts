import { google } from 'googleapis';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

if (!GOOGLE_REDIRECT_URI) {
    console.error("CRITICAL ERROR: GOOGLE_REDIRECT_URI is missing from process.env! Defaulting to localhost (Auth will fail on Vercel).");
}

const FINAL_REDIRECT_URI = GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback';
console.log("DEBUG: Using Redirect URI ->", FINAL_REDIRECT_URI);

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn("WARNING: Google Client ID or Secret is missing. Auth will fail.");
}

export const getOauth2Client = () => {
    return new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        FINAL_REDIRECT_URI
    );
};

export const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email'
];

// Simple encryption for tokens in DB (ideally you'd use a dedicated secrets manager or a robust encryption strategy)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'); // 32 bytes for AES-256
const IV_LENGTH = 16; // AES block size

export const encryptToken = (text: string): string => {
    if (!text) return text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

export const decryptToken = (text: string): string => {
    if (!text) return text;
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift() as string, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};
