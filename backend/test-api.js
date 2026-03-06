
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Extract project ref from the hostname
const projectUrl = 'https://ettyaurdhdhnavzhkyyk.supabase.co';
// We need the anon key for this to work, but we can try to see if we can at least reach the API
// Usually the user provides the service role key or anon key.
// Since I don't have it, I'll ask the user, but first let's see if 
// the DATABASE_URL can be used to connect via a different method if port 5432 is blocked.

console.log('Testing Supabase API connectivity (HTTPS)...');

async function testApi() {
    try {
        const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
        const response = await fetch(`${projectUrl}/rest/v1/`, {
            method: 'GET',
            headers: {
                'apikey': 'dummy', // This will 401 but confirms connectivity
            }
        });
        console.log('✅ Supabase API reached! Status:', response.status);
        console.log('This confirms that HTTPS (Port 443) to Supabase works.');
    } catch (err) {
        console.error('❌ Supabase API unreachable:', err.message);
    }
}

testApi();
