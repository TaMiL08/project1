import { Router } from 'express';
import { Email } from '../models/Email';
import { fetchUnreadEmails } from '../services/emailFetcher';

const router = Router();

// Get all emails (with optional status filter)
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        const whereClause = status ? { status: status as string } : {};

        const emails = await Email.findAll({
            where: whereClause,
            order: [['created_at', 'DESC']],
        });

        res.json(emails);
    } catch (error) {
        console.error('Error fetching emails from DB:', error);
        res.status(500).json({ error: 'Failed to fetch emails' });
    }
});

// Update email (e.g., save edited reply, change status)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, edited_reply } = req.body;

        const email = await Email.findByPk(id);
        if (!email) {
            return res.status(404).json({ error: 'Email not found' });
        }

        if (status) email.status = status;
        if (edited_reply !== undefined) email.edited_reply = edited_reply;

        await email.save();
        res.json(email);
    } catch (error) {
        console.error('Error updating email:', error);
        res.status(500).json({ error: 'Failed to update email' });
    }
});

// Trigger a manual sync from Gmail
router.post('/sync', async (req, res) => {
    try {
        // In a real app, you would retrieve the access/refresh tokens from the authenticated user's session or DB.
        // For this prototype, we're assuming they are passed in headers or body, or we just rely on the currently active token if any.
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
        const email = await Email.findByPk(id);

        if (!email) {
            return res.status(404).json({ error: 'Email not found' });
        }

        // In a real application, you would use Gmail API to send the email here.
        // google.gmail('v1').users.messages.send(...)

        email.status = 'sent';
        await email.save();

        res.json({ message: 'Email reply sent successfully', email });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

export default router;
