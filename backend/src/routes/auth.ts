import { Router } from 'express';
import { getOauth2Client, SCOPES, encryptToken } from '../config/google';
import { google } from 'googleapis';

const router = Router();

router.get('/google', (req, res) => {
    try {
        const oauth2Client = getOauth2Client();
        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent'
        });
        res.redirect(url);
    } catch (error: any) {
        console.error('Error generating auth URL:', error.message);
        res.status(500).send(`Configuration Error: ${error.message}`);
    }
});

router.get('/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).send('No authorization code provided');
    }

    try {
        const oauth2Client = getOauth2Client();
        const { tokens } = await oauth2Client.getToken(code as string);
        oauth2Client.setCredentials(tokens);

        // Retrieve user profile
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data: profile } = await oauth2.userinfo.get();

        console.log('User logged in:', profile.email);

        // In this application, we store the tokens for future Gmail access.
        const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;
        const encryptedAccessToken = encryptToken(tokens.access_token!);

        // Redirect to frontend dashboard
        // Note: For production, ensure process.env.FRONTEND_URL is set in Vercel.
        const frontendUrl = process.env.FRONTEND_URL || '/';
        res.redirect(`${frontendUrl}?auth=success&email=${profile.email}`);
    } catch (error: any) {
        console.error('Error during Google callback:', error.message);
        res.status(500).send('Authentication failed');
    }
});

export default router;
