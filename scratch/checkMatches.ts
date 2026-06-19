import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function run() {
  try {
    const totalMatches = await prisma.match.count();
    console.log('Total matches in DB:', totalMatches);

    const statusCounts = await prisma.match.groupBy({
      by: ['status'],
      _count: {
        _all: true
      }
    });
    console.log('Match counts by status:', statusCounts);

    const sampleMatches = await prisma.match.findMany({
      take: 5,
      orderBy: { matchTime: 'asc' }
    });
    console.log('Sample matches (first 5):', JSON.stringify(sampleMatches, null, 2));

    const finishedMatches = await prisma.match.findMany({
      where: { status: 'FINISHED' },
      take: 5
    });
    console.log('Finished matches sample:', JSON.stringify(finishedMatches, null, 2));
  } catch (err: any) {
    console.error('Error querying DB:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
