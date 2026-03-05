import { Router } from 'express';
import { getOauth2Client, SCOPES, encryptToken } from '../config/google';
import { google } from 'googleapis';

const router = Router();

router.get('/google', (req, res) => {
    const oauth2Client = getOauth2Client();
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
    });
    res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const oauth2Client = getOauth2Client();
        const { tokens } = await oauth2Client.getToken(code as string);

        // In a real app, you would tie this token to the logged-in user in the database.
        // For this prototype, we'll assume a single user and store it in a generic way or send it to the client.
        const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;
        const encryptedAccessToken = encryptToken(tokens.access_token!);

        // Redirect to frontend dashboard with some indicator of success
        // In production, use HttpOnly cookies for security.
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}?auth=success`);
    } catch (error) {
        console.error('Error during Google callback', error);
        res.status(500).send('Authentication failed');
    }
});

export default router;
