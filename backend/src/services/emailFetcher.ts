import { google } from 'googleapis';
import { getOauth2Client } from '../config/google';
import { inMemoryEmails, EmailData } from '../models/Email';
import { processEmailWithAI } from './aiProcessor';

export const fetchUnreadEmails = async (accessToken: string, refreshToken?: string) => {
    const oauth2Client = getOauth2Client();
    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    try {
        console.log('DEBUG: Fetching emails from Gmail...');
        const listResponse = await gmail.users.messages.list({
            userId: 'me',
            q: 'label:INBOX',
            maxResults: 10,
        });

        const messages = listResponse.data.messages || [];
        console.log(`DEBUG: Found ${messages.length} messages in INBOX.`);

        for (const message of messages) {
            if (!message.id) continue;

            const existingEmail = inMemoryEmails.find((e: EmailData) => e.id === message.id);
            if (existingEmail) continue;

            const msgData = await gmail.users.messages.get({
                userId: 'me',
                id: message.id,
                format: 'full',
            });

            const payload = msgData.data.payload;
            const headers = payload?.headers || [];

            const subject = headers.find((h) => h.name === 'Subject')?.value || 'No Subject';
            const sender = headers.find((h) => h.name === 'From')?.value || 'Unknown Sender';

            let bodyText = '';
            if (payload?.parts) {
                const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
                if (textPart && textPart.body && textPart.body.data) {
                    bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf8');
                }
            } else if (payload?.body && payload.body.data) {
                bodyText = Buffer.from(payload.body.data, 'base64').toString('utf8');
            }

            const aiResult = await processEmailWithAI(subject, bodyText);

            // Save to In-Memory storage
            const newEmail: EmailData = {
                id: message.id,
                sender,
                subject,
                body: bodyText,
                summary: aiResult?.summary || 'Failed to generate summary.',
                ai_reply: aiResult?.reply || 'Failed to generate reply.',
                edited_reply: null,
                status: 'pending',
                created_at: new Date(),
                updated_at: new Date()
            };

            inMemoryEmails.push(newEmail);

            await gmail.users.messages.modify({
                userId: 'me',
                id: message.id,
                requestBody: {
                    removeLabelIds: ['UNREAD']
                }
            });
        }

        console.log(`Processed ${messages.length} emails into memory.`);
    } catch (error) {
        console.error('Error fetching emails from Gmail', error);
    }
};
