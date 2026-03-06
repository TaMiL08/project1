import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const getOpenAIClient = () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is missing. Please set it in your environment variables.');
    }
    return new OpenAI({ apiKey });
};

export const processEmailWithAI = async (subject: string, bodyText: string) => {
    try {
        const openai = getOpenAIClient();
        const truncatedBody = bodyText.substring(0, 2000);

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are a professional email assistant. Respond in JSON: {"summary": "2-sentence summary", "reply": "A helpful draft reply in the sender\'s style"}'
                },
                {
                    role: 'user',
                    content: `Please read and draft a reply to this email:\nSubject: ${subject}\nBody: ${truncatedBody}`
                }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 400,
        });

        const aiContent = response.choices[0].message.content;
        if (!aiContent) return null;

        const parsedResult = JSON.parse(aiContent);
        return {
            summary: parsedResult.summary || 'Summary generated.',
            reply: parsedResult.reply || 'No reply suggested.',
        };
    } catch (error: any) {
        console.error('AI Error:', error.message);
        return null; // Fallback to "Pending" in DB
    }
};

export const refineReplyWithAI = async (subject: string, bodyText: string, userInstruction: string) => {
    try {
        const openai = getOpenAIClient();
        const truncatedBody = bodyText.substring(0, 2000);

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are a professional email assistant. Your job is to rewrite or draft an email reply based on the user\'s specific instructions while maintaining a professional and helpful tone.'
                },
                {
                    role: 'user',
                    content: `Original Email Details:\nSubject: ${subject}\nBody: ${truncatedBody}\n\nUser's specific instruction for the reply: "${userInstruction}"\n\nPlease provide ONLY the text of the reply draft.`
                }
            ],
            max_tokens: 500,
        });

        return response.choices[0].message.content?.trim() || null;
    } catch (error: any) {
        console.error('AI Refine Error:', error.message);
        return null;
    }
};


