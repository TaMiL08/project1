import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const processEmailWithAI = async (subject: string, bodyText: string) => {
    try {
        const prompt = `
      You are an AI email assistant. Summarize the following email in exactly 3 lines, identifying the key action required. Then, generate a professional suggested reply.

      Input:
      Email subject: ${subject}
      Email body: ${bodyText}

      Return your output strictly as a JSON object with two fields: "summary" and "reply".
    `;

        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo', // or gpt-4 depending on the API key and preference
            messages: [
                { role: 'system', content: 'You are a helpful AI assistant that processes emails.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 500,
            temperature: 0.7,
        });

        const aiContent = response.choices[0].message.content;

        if (!aiContent) {
            throw new Error('No content returned from OpenAI API.');
        }

        const parsedResult = JSON.parse(aiContent);
        return {
            summary: parsedResult.summary,
            reply: parsedResult.reply,
        };
    } catch (error) {
        console.error('Error processing email with OpenAI', error);
        return null;
    }
};
