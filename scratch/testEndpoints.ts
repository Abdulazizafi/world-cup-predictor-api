import axios from 'axios';

const endpoints = [
  'https://worldcup26.ir/api/get/games',
  'https://worldcup26.ir/api/matches',
  'https://worldcup26.ir/api/api/get/games',
  'https://worldcup26.ir/api/v1/matches',
  'https://worldcup26.ir/api/games',
  'https://worldcup26.ir/get/games',
  'https://worldcup26.ir/matches',
  'https://worldcup26.ir/games'
];

async function run() {
  for (const url of endpoints) {
    console.log(`Testing: ${url}...`);
    try {
      const start = Date.now();
      const res = await axios.get(url, { timeout: 10000 });
      console.log(`  ✅ SUCCESS in ${Date.now() - start}ms! Data length: ${JSON.stringify(res.data).length}`);
    } catch (err: any) {
      console.log(`  ❌ FAILED: ${err.message}`);
    }
  }
}

run();
