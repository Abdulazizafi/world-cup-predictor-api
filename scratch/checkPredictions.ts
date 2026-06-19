import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function run() {
  const matchId = 'a2e9ea8a-68ce-48c5-8224-6904b84323e1'; // Germany v Curaçao
  try {
    const predictions = await prisma.prediction.findMany({
      where: { matchId },
      include: {
        user: true
      }
    });
    console.log(`Total predictions for Germany v Curaçao (matchId: ${matchId}):`, predictions.length);
    console.log('Predictions list:', JSON.stringify(predictions.map(p => ({
      username: p.user.username,
      predicted: `${p.predictedScoreA}-${p.predictedScoreB}`,
      doublePoints: p.useDoublePoints,
      pointsEarned: p.pointsEarned
    })), null, 2));
  } catch (err: any) {
    console.error('Error querying DB:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
