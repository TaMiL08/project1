import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config();

const getGeminiClient = () => {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY)?.trim();
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is missing. Please set it in your environment variables.');
    }
    return new GoogleGenerativeAI(apiKey);
};

export const processEmailWithAI = async (subject: string, bodyText: string) => {
    try {
        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        summary: { type: SchemaType.STRING },
                        reply: { type: SchemaType.STRING }
                    }
                }
            }
        });

        const truncatedBody = bodyText.substring(0, 3000);
        const prompt = `You are a professional email assistant. Please analyze this email and generate a 2-sentence summary and a professional draft reply.
        
        Original Email Details:
        Subject: ${subject}
        Body: ${truncatedBody}`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        const parsedResult = JSON.parse(text);
        return {
            summary: parsedResult.summary || 'Summary generated.',
            reply: parsedResult.reply || 'No reply suggested.',
        };
    } catch (error: any) {
        console.error('Gemini processing error:', error.message);
        return null;
    }
};

export const refineReplyWithAI = async (subject: string, bodyText: string, userInstruction: string) => {
    try {
        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        const truncatedBody = (bodyText || '').substring(0, 3000);
        const prompt = `Original Email Details:
        Subject: ${subject}
        Body: ${truncatedBody}

        User's specific instruction for the reply: "${userInstruction}"

        Please provide ONLY the text of the reply draft. No intro/outro.`;

        console.log('DEBUG Gemini Refine: Sending prompt to Gemini-1.5-Flash-Latest');
        const result = await model.generateContent(prompt);
        console.log('DEBUG Gemini Refine: Received response from Gemini');
        return result.response.text().trim();
    } catch (error: any) {
        console.error('Gemini refine error:', error.message);
        throw error;
    }
};


