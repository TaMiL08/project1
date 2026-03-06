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


// Send email reply (mock)
router.post('/:id/send', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: email, error } = await supabase
            .from('emails')
            .update({ status: 'sent', updated_at: new Date() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        if (!email) return res.status(404).json({ error: 'Email not found' });

        res.json({ message: 'Email reply sent successfully', email });
    } catch (error: any) {
        console.error('Error sending email (Supabase update):', error);
        res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
});

export default router;

