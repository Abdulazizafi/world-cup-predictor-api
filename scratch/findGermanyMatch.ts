import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function run() {
  try {
    const match = await prisma.match.findFirst({
      where: {
        OR: [
          { teamA: { contains: 'Germany', mode: 'insensitive' } },
          { teamB: { contains: 'Germany', mode: 'insensitive' } }
        ]
      }
    });
    console.log('Germany match in DB:', JSON.stringify(match, null, 2));
  } catch (err: any) {
    console.error('Error querying DB:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
