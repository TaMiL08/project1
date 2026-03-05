import path from 'path';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
import { initDB } from '../initDb';

const runSync = async () => {
    console.log('--- Database Synchronization Script ---');
    try {
        await initDB();
        console.log('SUCCESS: Database tables created/updated successfully.');
        process.exit(0);
    } catch (error) {
        console.error('ERROR: Database synchronization failed:');
        console.error(error);
        process.exit(1);
    }
};

runSync();
