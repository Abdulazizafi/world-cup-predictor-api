import axios from 'axios';

const apiBase = 'https://world-cup-predictor-api-vo4r.onrender.com/api';

async function main() {
  console.log('Logging in to production API...');
  
  // Login as sheikh_test (or another user)
  const loginRes = await axios.post(`${apiBase}/auth/login`, {
    username: 'sheikh_test',
    password: 'password123'
  });
  
  const cookie = loginRes.headers['set-cookie']?.join('; ');
  console.log('Login successful! Cookie received:', cookie ? 'Yes' : 'No');
  
  // Fetch matches
  const matchesRes = await axios.get(`${apiBase}/matches`, {
    headers: { Cookie: cookie }
  });
  
  const matches = matchesRes.data.data.matches;
  console.log('Total matches returned:', matches.length);
  
  const recent = matches.filter((m: any) => ['33', '34', '35', '36', '37', '39', '40'].includes(String(m.externalId)));
  console.log('Recent matches details:');
  recent.forEach((m: any) => {
    console.log(`- ID ${m.externalId}: ${m.teamA} vs ${m.teamB}, status: ${m.status}, score: ${m.scoreA}-${m.scoreB}, points: ${m.userPrediction ? m.userPrediction.pointsEarned : 'No pred'}`);
  });
}

main().catch(console.error);
