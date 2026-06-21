const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const matches = await prisma.match.findMany({
    where: {
      matchTime: {
        gte: new Date('2026-06-18T00:00:00Z'),
        lte: new Date('2026-06-22T23:59:59Z')
      }
    },
    orderBy: { matchTime: 'asc' }
  });
  
  console.log(`Found ${matches.length} matches between June 18 and June 22:`);
  matches.forEach(m => {
    console.log(`- ID: ${m.externalId}, ${m.teamA} vs ${m.teamB}, status: ${m.status}, score: ${m.scoreA}-${m.scoreB}, time: ${m.matchTime.toISOString()}`);
  });
  
  await prisma.$disconnect();
}

main().catch(console.error);
