
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const projectUrl = 'https://ettyaurdhdhnavzhkyyk.supabase.co';
const anonKey = 'sb_publishable_PH5peVec64zHviwpS7_iMw_2METswYH';

async function testSupabase() {
    const supabase = createClient(projectUrl, anonKey);

    try {
        console.log('Testing Supabase Client connection (HTTPS)...');

        // Try to list tables or something simple
        // Note: If no tables are public, this might return empty but no error
        const { data, error } = await supabase.from('emails').select('*').limit(1);

        if (error) {
            if (error.code === 'PGRST116' || error.message.includes('relation "public.emails" does not exist')) {
                console.log('✅ Connected to Supabase! (But "emails" table doesn\'t exist yet)');
            } else {
                console.error('❌ Supabase Query Error:', error.message);
            }
        } else {
            console.log('✅ Connected and queried successfully!');
            console.log('Data sample:', data);
        }

    } catch (err) {
        console.error('❌ Unexpected Error:', err.message);
    }
}

testSupabase();
