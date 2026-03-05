import { google } from 'googleapis';
import { getOauth2Client } from '../config/google';
import { Email } from '../models/Email';
import { processEmailWithAI } from './aiProcessor';

// In a real application, you'd fetch the user's stored refresh token from the DB.
// For this single-user prototype, we'll keep it simple and expect it to be passed or available.
export const fetchUnreadEmails = async (accessToken: string, refreshToken?: string) => {
    const oauth2Client = getOauth2Client();
    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    try {
        // 1. Get list of unread messages in INBOX
        const listResponse = await gmail.users.messages.list({
            userId: 'me',
            q: 'is:unread in:inbox',
            maxResults: 10,
        });

        const messages = listResponse.data.messages || [];

        for (const message of messages) {
            if (!message.id) continue;

            // Check if we already processed this email
            const existingEmail = await Email.findOne({ where: { id: message.id } });
            if (existingEmail) continue;

            // 2. Fetch full message details
            const msgData = await gmail.users.messages.get({
                userId: 'me',
                id: message.id,
                format: 'full',
            });

            const payload = msgData.data.payload;
            const headers = payload?.headers || [];

            const subject = headers.find((h) => h.name === 'Subject')?.value || 'No Subject';
            const sender = headers.find((h) => h.name === 'From')?.value || 'Unknown Sender';

            // Extract body (simplified: checking for plain text in parts or body data)
            let bodyText = '';
            if (payload?.parts) {
                const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
                if (textPart && textPart.body && textPart.body.data) {
                    bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf8');
                }
            } else if (payload?.body && payload.body.data) {
                bodyText = Buffer.from(payload.body.data, 'base64').toString('utf8');
            }

            // 3. Process with AI
            const aiResult = await processEmailWithAI(subject, bodyText);

            // 4. Save to Database
            await Email.create({
                id: message.id, // Using Gmail's message ID as our UUID replacement for simplicity, or we can use our own UUID and store gmail_id
                sender,
                subject,
                body: bodyText,
                summary: aiResult?.summary || 'Failed to generate summary.',
                ai_reply: aiResult?.reply || 'Failed to generate reply.',
                status: 'pending'
            });

            // 5. Optionally remove the UNREAD label so we don't fetch it again
            await gmail.users.messages.modify({
                userId: 'me',
                id: message.id,
                requestBody: {
                    removeLabelIds: ['UNREAD']
                }
            });
        }

        console.log(`Processed ${messages.length} emails.`);
    } catch (error) {
        console.error('Error fetching emails from Gmail', error);
    }
};
