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
        console.log('Exchanging code for tokens...');
        const { tokens } = await oauth2Client.getToken(code as string).catch(err => {
            console.error('Token Exchange Error:', err.message);
            throw err;
        });

        oauth2Client.setCredentials(tokens);

        // Retrieve user profile
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data: profile } = await oauth2.userinfo.get();

        console.log('User logged in successfully:', profile.email);

        // In this application, we store the tokens for future Gmail access.
        const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;
        const encryptedAccessToken = encryptToken(tokens.access_token!);

        // TRIGGER SYNC IMMEDIATELY
        console.log('Starting initial sync for:', profile.email);
        try {
            const { fetchUnreadEmails } = require('../services/emailFetcher');
            const stats = await fetchUnreadEmails(tokens.access_token!, tokens.refresh_token);
            console.log('Initial sync completed. Stats:', stats);
        } catch (syncErr: any) {
            console.error('Initial sync failed (non-blocking):', syncErr.message);
        }


        // Redirect to frontend dashboard with token and email
        let frontendUrl = process.env.FRONTEND_URL || '/';
        // Clean trailing slash from frontendUrl if it exists and we're appending query params
        if (frontendUrl.endsWith('/') && frontendUrl.length > 1) {
            frontendUrl = frontendUrl.slice(0, -1);
        }

        const redirectUrl = `${frontendUrl}?auth=success&email=${profile.email}&token=${tokens.access_token}`;
        console.log('Redirecting to frontend:', redirectUrl);
        res.redirect(redirectUrl);
    } catch (error: any) {
        console.error('CRITICAL: Error during Google callback:', error.message, error.stack);
        res.status(500).send(`Authentication failed: ${error.message}`);
    }
});

export default router;
