import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// dotenv.config() is handled in index.ts or by Vercel in production


const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
