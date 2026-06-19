const axios = require('axios');
async function test() {
  try {
    console.log('Sending GET / request to Render backend...');
    const res = await axios.get('https://world-cup-predictor-api-vo4r.onrender.com/', { timeout: 10000 });
    console.log('Status:', res.status);
  } catch (err) {
    if (err.response) {
      console.log('Status:', err.response.status);
    } else {
      console.log('Error:', err.message);
    }
  }
}
test();
