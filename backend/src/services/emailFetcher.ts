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
        console.log(`DEBUG: Found ${messages.length} messages in INBOX.`);

        for (const message of messages) {
            if (!message.id) continue;

            const { data: existingEmail } = await supabase
                .from('emails')
                .select('id')
                .eq('id', message.id)
                .maybeSingle();

            if (existingEmail) {
                stats.skipped++;
                console.log(`Email ${message.id} already exists in DB.`);
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

                let bodyText = '';
                if (payload?.parts) {
                    const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
                    if (textPart && textPart.body && textPart.body.data) {
                        bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf8');
                    } else {
                        // If no text/plain, try text/html and strip tags
                        const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
                        if (htmlPart && htmlPart.body && htmlPart.body.data) {
                            const html = Buffer.from(htmlPart.body.data, 'base64').toString('utf8');
                            bodyText = html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
                        }
                    }
                } else if (payload?.body && payload.body.data) {
                    const content = Buffer.from(payload.body.data, 'base64').toString('utf8');
                    if (payload.mimeType === 'text/html') {
                        bodyText = content.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
                    } else {
                        bodyText = content;
                    }
                }


                const aiResult = await processEmailWithAI(subject, bodyText);

                const newEmail = {
                    id: message.id,
                    sender,
                    subject,
                    body: bodyText,
                    summary: aiResult?.summary || 'Summary pending...',
                    ai_reply: aiResult?.reply || 'Drafting reply...',
                    status: 'pending',
                    created_at: new Date(),
                    updated_at: new Date()
                };

                const { error: insertError } = await supabase.from('emails').insert([newEmail]);

                if (insertError) {
                    console.error('Supabase Insert Error:', insertError.message);
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

