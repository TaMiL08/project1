
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const projectUrl = 'https://ettyaurdhdhnavzhkyyk.supabase.co';
const anonKey = 'sb_publishable_PH5peVec64zHviwpS7_iMw_2METswYH';

const supabase = createClient(projectUrl, anonKey);

async function setupDatabase() {
    console.log('Attempting to create "emails" table in Supabase via SQL...');

    // Note: Supabase JS client doesn't support arbitrary SQL execution for security reasons.
    // Usually, you create tables in the Supabase Dashboard or via migrations.
    // However, we can try to "insert" to see if RLS allows it, but it will fail if table doesn't exist.

    const sql = `
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      sender TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      summary TEXT,
      ai_reply TEXT,
      edited_reply TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

    console.log('--- ACTION REQUIRED ---');
    console.log('Please copy and paste the following SQL into the Supabase SQL Editor:');
    console.log(sql);
    console.log('-----------------------');
}

setupDatabase();
