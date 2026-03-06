import { Router } from 'express';
import { supabase } from '../config/supabase';
import { fetchUnreadEmails } from '../services/emailFetcher';

const router = Router();

// Get all emails (with optional status filter)
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;

        let query = supabase
            .from('emails')
            .select('*')
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status as string);
        }

        const { data: emails, error } = await query;

        if (error) throw error;

        res.json(emails || []);
    } catch (error: any) {
        console.error('Error fetching emails from Supabase:', error);
        res.status(500).json({ error: 'Failed to fetch emails', details: error.message });
    }
});

// Update email (e.g., save edited reply, change status)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, edited_reply } = req.body;

        const updateData: any = { updated_at: new Date() };
        if (status) updateData.status = status;
        if (edited_reply !== undefined) updateData.edited_reply = edited_reply;

        const { data: email, error } = await supabase
            .from('emails')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        if (!email) return res.status(404).json({ error: 'Email not found' });

        res.json(email);
    } catch (error: any) {
        console.error('Error updating email in Supabase:', error);
        res.status(500).json({ error: 'Failed to update email', details: error.message });
    }
});

// Trigger a manual sync from Gmail
router.post('/sync', async (req, res) => {
    try {
        const { access_token, refresh_token } = req.body;

        if (!access_token) {
            return res.status(400).json({ error: 'Access token is required to sync emails' });
        }

        // We MUST await this on Vercel, otherwise the function dies before sync finishes
        try {
            const stats = await fetchUnreadEmails(access_token, refresh_token);
            res.json({ message: 'Sync completed', stats });
        } catch (err: any) {
            console.error('Sync failed:', err);
            res.status(500).json({ error: 'Sync failed', details: err.message });
        }

    } catch (error) {
        console.error('Error starting sync:', error);
        res.status(500).json({ error: 'Failed to start sync' });
    }
});


import { google } from 'googleapis';
import { getOauth2Client } from '../config/google';

// Send email reply (Actual Gmail API)
router.post('/:id/send', async (req, res) => {
    try {
        const { id } = req.params;
        const { access_token } = req.body;

        if (!access_token) {
            return res.status(401).json({ error: 'Auth token missing' });
        }

        // 1. Get email data from Supabase
        const { data: email, error: dbError } = await supabase
            .from('emails')
            .select('*')
            .eq('id', id)
            .single();

        if (dbError || !email) return res.status(404).json({ error: 'Email not found' });

        const replyBody = email.edited_reply || email.ai_reply;
        if (!replyBody) return res.status(400).json({ error: 'No reply template found' });

        // 2. Clear credentials and set for this user
        const oauth2Client = getOauth2Client();
        oauth2Client.setCredentials({ access_token });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // 3. Construct the email (Base64 URL Safe)
        const str = [
            `To: ${email.sender}`,
            `Subject: Re: ${email.subject}`,
            'Content-Type: text/plain; charset=utf-8',
            'MIME-Version: 1.0',
            '',
            replyBody
        ].join('\n');

        const encodedMail = Buffer.from(str)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        // 4. Send via Gmail
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: encodedMail, threadId: email.id }
        });

        // 5. Update Status in DB
        const { data: updatedEmail } = await supabase
            .from('emails')
            .update({ status: 'sent', updated_at: new Date() })
            .eq('id', id)
            .select()
            .single();

        res.json({ message: 'Email sent successfully!', email: updatedEmail });
    } catch (error: any) {
        console.error('Email Send Error:', error.message);
        res.status(500).json({ error: 'Gmail Send Failed', details: error.message });
    }
});

// Download Attachment
router.get('/:id/attachments/:attachmentId', async (req, res) => {
    try {
        const { id, attachmentId } = req.params;
        const accessToken = req.query.access_token as string;

        if (!accessToken) return res.status(401).send('Unauthorized');

        const oauth2Client = getOauth2Client();
        oauth2Client.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const attachment = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: id,
            id: attachmentId
        });

        const data = attachment.data.data;
        if (!data) return res.status(404).send('Attachment data not found');

        // Convert base64url to Buffer
        const buffer = Buffer.from(data, 'base64');

        // We need the filename for headers. Let's get it from DB.
        const { data: email } = await supabase.from('emails').select('attachments').eq('id', id).single();
        const meta = email?.attachments?.find((a: any) => a.attachmentId === attachmentId);

        res.setHeader('Content-Disposition', `attachment; filename="${meta?.filename || 'download'}"`);
        res.setHeader('Content-Type', meta?.mimeType || 'application/octet-stream');
        res.send(buffer);

    } catch (err: any) {
        console.error('Download Error:', err);
        res.status(500).send('Failed to download');
    }
});



export default router;

