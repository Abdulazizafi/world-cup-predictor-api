const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const apiBase = 'http://localhost:3000/api';

async function run() {
  const username = 'insightstester_' + Math.floor(Math.random() * 1000);
  const password = 'testpassword123';
  const groupId = '189ab062-08a6-46e3-bd0c-d17bfd5f3cfa'; // Istraha

  let testUser = null;
  let membership = null;

  try {
    console.log('1. Creating test user in database:', username);
    const passwordHash = await bcrypt.hash(password, 10);
    testUser = await prisma.user.create({
      data: {
        username,
        passwordHash
      }
    });

    console.log('2. Adding user to group:', groupId);
    membership = await prisma.groupMember.create({
      data: {
        groupId,
        userId: testUser.id
      }
    });

    console.log('3. Sending login request via API...');
    const loginRes = await axios.post(`${apiBase}/auth/login`, {
      username,
      password
    }, {
      validateStatus: false
    });

    console.log('Login status:', loginRes.status);
    console.log('Login body:', loginRes.data);

    // Extract cookie from response headers
    const setCookie = loginRes.headers['set-cookie'];
    console.log('Set-Cookie headers:', setCookie);

    if (!setCookie) {
      throw new Error('No cookie returned on login');
    }

    // Clean cookie header
    const cookie = setCookie.map(c => c.split(';')[0]).join('; ');

    console.log('4. Querying insights endpoint via API...');
    const insightsRes = await axios.get(`${apiBase}/groups/${groupId}/insights`, {
      headers: {
        Cookie: cookie
      },
      validateStatus: false
    });

    console.log('Insights status:', insightsRes.status);
    console.log('Insights body:', JSON.stringify(insightsRes.data, null, 2));

  } catch (err) {
    console.error('Error during test:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
    }
  } finally {
    // 5. Cleanup
    console.log('5. Cleaning up database records...');
    if (membership) {
      await prisma.groupMember.delete({ where: { id: membership.id } }).catch(console.error);
    }
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(console.error);
    }
    await prisma.$disconnect();
    console.log('Done!');
  }
}

run();
