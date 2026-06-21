module.paths.push('C:/Users/alowa/.gemini/antigravity/scratch/world-cup-predictor-api/node_modules');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const url = 'https://worldcup26.ir/get/games';

const https = require('https');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function main() {
  const dbMatches = await prisma.match.findMany();
  
  const res = await axios.get(url, {
    timeout: 25000,
    httpsAgent,
    headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json' 
    },
  });
  
  const apiMatches = Array.isArray(res.data) ? res.data : (res.data.games ?? res.data.matches ?? res.data.data ?? []);
  
  console.log('Database matches count:', dbMatches.length);
  console.log('API matches count:', apiMatches.length);
  
  const dbIds = new Set(dbMatches.map(m => String(m.externalId)));
  const apiIds = new Set(apiMatches.map(m => String(m.id)));
  
  const extraInDb = dbMatches.filter(m => !apiIds.has(String(m.externalId)));
  const extraInApi = apiMatches.filter(m => !dbIds.has(String(m.id)));
  
  console.log('\nExtra in DB (not in API):', extraInDb.map(m => `${m.externalId}: ${m.teamA} vs ${m.teamB}`));
  console.log('\nExtra in API (not in DB):', extraInApi.map(m => `${m.id}: ${m.home_team_name_en} vs ${m.away_team_name_en}`));
  
  await prisma.$disconnect();
}

main().catch(console.error);
