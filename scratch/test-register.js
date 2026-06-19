const axios = require('axios');

async function main() {
  try {
    console.log('Sending register request to Render backend...');
    const response = await axios.post('https://world-cup-predictor-api-vo4r.onrender.com/api/auth/register', {
      username: 'testuser123' + Math.floor(Math.random() * 1000),
      password: 'password123'
    }, {
      timeout: 15000
    });
    console.log('Status Code:', response.status);
    console.log('Response Data:', JSON.stringify(response.data));
  } catch (error) {
    if (error.response) {
      console.log('Error Status:', error.response.status);
      console.log('Error Data:', JSON.stringify(error.response.data));
    } else {
      console.error('Network/Timeout Error:', error.message);
    }
  }
}

main();
