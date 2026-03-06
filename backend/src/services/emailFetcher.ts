import { google } from 'googleapis';
import { getOauth2Client } from '../config/google';
import { supabase } from '../config/supabase';
import { processEmailWithAI } from './aiProcessor';

export const fetchUnreadEmails = async (accessToken: string, refreshToken?: string) => {
    const oauth2Client = getOauth2Client();
    oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const stats = { found: 0, skipped: 0, inserted: 0, errors: 0 };

    try {
        console.log('DEBUG: Querying Gmail for the 3 most recent inbox messages...');
        const listResponse = await gmail.users.messages.list({
            userId: 'me',
            q: 'label:INBOX',
            maxResults: 3,
        });


        const messages = listResponse.data.messages || [];
        stats.found = messages.length;

        for (const message of messages) {
            if (!message.id) continue;

            const { data: existingEmail } = await supabase
                .from('emails')
                .select('id, status')
                .eq('id', message.id)
                .maybeSingle();

            // If it exists and is already processed, skip.
            // If it exists but is 'pending', we re-process it to fix blank content.
            if (existingEmail && existingEmail.status !== 'pending') {
                stats.skipped++;
                continue;
            }

            try {
                const msgData = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                    format: 'full',
                });

                const payload = msgData.data.payload;
                const headers = payload?.headers || [];
                const subject = headers.find((h) => h.name === 'Subject')?.value || 'No Subject';
                const sender = headers.find((h) => h.name === 'From')?.value || 'Unknown Sender';

                let bodyTextForAI = '';
                let originalBody = '';
                const attachments: any[] = [];

                const cleanHtml = (html: string) => {
                    return html
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                        .replace(/<[^>]*>?/gm, ' ')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                };

                const processPart = (part: any) => {
                    if (part.mimeType === 'text/plain' && part.body.data) {
                        const text = Buffer.from(part.body.data, 'base64').toString('utf8');
                        if (!bodyTextForAI) bodyTextForAI = text;
                        if (!originalBody) originalBody = text;
                    } else if (part.mimeType === 'text/html' && part.body.data) {
                        const html = Buffer.from(part.body.data, 'base64').toString('utf8');
                        originalBody = html;
                        bodyTextForAI = cleanHtml(html);
                    }

                    if (part.filename && part.body.attachmentId) {
                        attachments.push({
                            attachmentId: part.body.attachmentId,
                            filename: part.filename,
                            mimeType: part.mimeType,
                            size: part.body.size
                        });
                    }

                    if (part.parts) part.parts.forEach(processPart);
                };

                // Check top level body
                if (payload?.body?.data) {
                    const data = Buffer.from(payload.body.data, 'base64').toString('utf8');
                    originalBody = data;
                    bodyTextForAI = (payload.mimeType === 'text/html') ? cleanHtml(data) : data;
                }

                // Check parts recursively
                if (payload?.parts) payload.parts.forEach(processPart);

                const aiResult = await processEmailWithAI(subject, bodyTextForAI);

                const emailUpdate = {
                    id: message.id,
                    sender,
                    subject,
                    body: originalBody || '(No content found)',
                    summary: aiResult?.summary || 'Summary pending...',
                    ai_reply: aiResult?.reply || 'Drafting reply...',
                    status: 'pending',
                    attachments: attachments.length > 0 ? attachments : null,
                    updated_at: new Date()
                };

                const { error: upsertError } = await supabase.from('emails').upsert([emailUpdate]);

                if (upsertError) {
                    console.error('Supabase Upsert Error:', upsertError.message);
                    stats.errors++;
                } else {
                    stats.inserted++;
                    // Optional: remove unread label
                    await gmail.users.messages.modify({
                        userId: 'me',
                        id: message.id,
                        requestBody: { removeLabelIds: ['UNREAD'] }
                    }).catch(() => { });
                }
            } catch (err) {
                console.error(`Error processing msg ${message.id}:`, err);
                stats.errors++;
            }
        }
        return stats;
    } catch (error: any) {
        console.error('Gmail List Error:', error.message);
        throw error;
    }
};
