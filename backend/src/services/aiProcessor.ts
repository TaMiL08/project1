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

        // Truncate body text to avoid token limits (keep it under 3000 chars)
        const truncatedBody = bodyText.substring(0, 3000);

        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo-1106',
            messages: [
                {
                    role: 'system',
                    content: 'You are a professional email assistant. You must always respond in valid JSON format with "summary" and "reply" fields.'
                },
                {
                    role: 'user',
                    content: `Summarize this email in 2 sentences and write a brief professional reply.
                    Subject: ${subject}
                    Body: ${truncatedBody}`
                }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 500,
        });

        const aiContent = response.choices[0].message.content;

        if (!aiContent) return null;

        const parsedResult = JSON.parse(aiContent);
        return {
            summary: parsedResult.summary || 'Summary generated.',
            reply: parsedResult.reply || 'No reply suggested.',
        };
    } catch (error: any) {
        console.error('OpenAI Error Details:', error.message);
        return null;
    }
};

