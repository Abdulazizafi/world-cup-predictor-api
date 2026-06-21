module.paths.push('C:/Users/alowa/.gemini/antigravity/scratch/world-cup-predictor-api/node_modules');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const finishedMatches = await prisma.match.findMany({
    where: { status: 'FINISHED' },
    select: { id: true, externalId: true, teamA: true, teamB: true, scoreA: true, scoreB: true }
  });
  
  console.log(`Found ${finishedMatches.length} finished matches.`);
  
  for (const match of finishedMatches) {
    const predictions = await prisma.prediction.findMany({
      where: { matchId: match.id }
    });
    
    const uncalculated = predictions.filter(p => p.pointsEarned === 0);
    // Note: pointsEarned could be 0 if the user predicted wrong.
    // Let's check if the points calculation engine has run for these.
    console.log(`- Match ${match.externalId} (${match.teamA} ${match.scoreA}-${match.scoreB} ${match.teamB}): total predictions: ${predictions.length}, uncalculated/0 points: ${uncalculated.length}`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
