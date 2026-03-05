export interface EmailData {
    id: string;
    sender: string;
    subject: string;
    body: string;
    summary: string | null;
    ai_reply: string | null;
    edited_reply: string | null;
    status: 'pending' | 'approved' | 'sent';
    created_at: Date;
    updated_at: Date;
}

// Global in-memory storage
export const inMemoryEmails: EmailData[] = [];
