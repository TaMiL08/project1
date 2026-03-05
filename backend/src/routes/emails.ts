import { Router } from 'express';
import { inMemoryEmails, EmailData } from '../models/Email';
import { fetchUnreadEmails } from '../services/emailFetcher';

const router = Router();

// Get all emails (with optional status filter)
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        let emails = [...inMemoryEmails];

        if (status) {
            emails = emails.filter((e: EmailData) => e.status === status);
        }

        // Sort by created_at DESC
        emails.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

        res.json(emails);
    } catch (error: any) {
        console.error('Error fetching emails:', error);
        res.status(500).json({ error: 'Failed to fetch emails', details: error.message });
    }
});

// Update email (e.g., save edited reply, change status)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, edited_reply } = req.body;

        const email = inMemoryEmails.find((e: EmailData) => e.id === id);
        if (!email) {
            return res.status(404).json({ error: 'Email not found' });
        }

        if (status) email.status = status;
        if (edited_reply !== undefined) email.edited_reply = edited_reply;
        email.updated_at = new Date();

        res.json(email);
    } catch (error) {
        console.error('Error updating email:', error);
        res.status(500).json({ error: 'Failed to update email' });
    }
});

// Trigger a manual sync from Gmail
router.post('/sync', async (req, res) => {
    try {
        const { access_token, refresh_token } = req.body;

        if (!access_token) {
            return res.status(400).json({ error: 'Access token is required to sync emails' });
        }

        // This will process emails in the background
        fetchUnreadEmails(access_token, refresh_token).catch(err => {
            console.error('Background sync failed:', err);
        });

        res.json({ message: 'Sync started' });
    } catch (error) {
        console.error('Error starting sync:', error);
        res.status(500).json({ error: 'Failed to start sync' });
    }
});

// Send email reply (mock)
router.post('/:id/send', async (req, res) => {
    try {
        const { id } = req.params;
        const email = inMemoryEmails.find((e: EmailData) => e.id === id);

        if (!email) {
            return res.status(404).json({ error: 'Email not found' });
        }

        email.status = 'sent';
        email.updated_at = new Date();

        res.json({ message: 'Email reply sent successfully', email });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

export default router;
