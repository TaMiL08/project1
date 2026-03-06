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
            maxResults: 1,
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

                const findParts = (parts: any[]) => {
                    for (const part of parts) {
                        if (part.mimeType === 'text/plain' && part.body.data && !originalBody) {
                            originalBody = Buffer.from(part.body.data, 'base64').toString('utf8');
                            bodyTextForAI = originalBody;
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

                        if (part.parts) findParts(part.parts);
                    }
                };

                if (payload?.parts) {
                    findParts(payload.parts);
                } else if (payload?.body && payload.body.data) {
                    originalBody = Buffer.from(payload.body.data, 'base64').toString('utf8');
                    bodyTextForAI = payload.mimeType === 'text/html' ? cleanHtml(originalBody) : originalBody;
                }

                const aiResult = await processEmailWithAI(subject, bodyTextForAI);

                const newEmail = {
                    id: message.id,
                    sender,
                    subject,
                    body: originalBody || '(No content)',
                    summary: aiResult?.summary || 'Summary pending...',
                    ai_reply: aiResult?.reply || 'Drafting reply...',
                    status: 'pending',
                    attachments: attachments.length > 0 ? attachments : null,
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

