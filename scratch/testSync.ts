import { syncMatches } from '../src/services/syncService';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  console.log('Running updated syncMatches with fallback seeding...');
  try {
    const result = await syncMatches();
    console.log('Sync result (total matches synced):', result);
  } catch (err: any) {
    console.error('Sync failed:', err);
  }
}

run();
