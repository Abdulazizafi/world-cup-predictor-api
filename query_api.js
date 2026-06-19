const axios = require('axios');
const https = require('https');

const agent = new https.Agent({
  rejectUnauthorized: false
});

const url = 'https://worldcup26.ir/get/games';

axios.get(url, {
  timeout: 30000,
  httpsAgent: agent,
  headers: { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json' 
  },
})
.then(res => {
  const games = Array.isArray(res.data) ? res.data : (res.data.games ?? res.data.matches ?? res.data.data);
  const match13 = games.find(g => String(g.id) === '13');
  console.log('Match 13 from External API:', match13);
})
.catch(console.error);
