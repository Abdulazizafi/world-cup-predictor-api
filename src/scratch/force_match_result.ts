import { PrismaClient } from '@prisma/client';
import { calculatePoints } from '../services/pointsEngine';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: node dist/scratch/force_match_result.js <externalId> <scoreA> <scoreB>');
    process.exit(1);
  }
  
  const externalId = args[0];
  const scoreA = parseInt(args[1], 10);
  const scoreB = parseInt(args[2], 10);
  
  if (isNaN(scoreA) || isNaN(scoreB)) {
    console.error('Scores must be integers.');
    process.exit(1);
  }
  
  console.log(`Searching for match with externalId: "${externalId}"...`);
  const match = await prisma.match.findUnique({
    where: { externalId }
  });
  
  if (!match) {
    console.error(`Match with externalId "${externalId}" not found in database.`);
    process.exit(1);
  }
  
  console.log(`Found match: ${match.teamA} vs ${match.teamB} (current status: ${match.status})`);
  console.log(`Updating to status: FINISHED, score: ${scoreA}-${scoreB}...`);
  
  const updatedMatch = await prisma.match.update({
    where: { id: match.id },
    data: {
      status: 'FINISHED',
      scoreA,
      scoreB
    }
  });
  
  console.log(`Match updated successfully.`);
  console.log(`Calculating points for predictions...`);
  
  const result = await calculatePoints(updatedMatch.id, scoreA, scoreB);
  console.log(`Points calculation complete: updated ${result.updated} predictions, awarded ${result.totalPoints} points in total.`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
