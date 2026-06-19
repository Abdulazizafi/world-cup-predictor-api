const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { teamA: { contains: 'Iran', mode: 'insensitive' } },
        { teamB: { contains: 'Iran', mode: 'insensitive' } },
        { teamA: { contains: 'New Zealand', mode: 'insensitive' } },
        { teamB: { contains: 'New Zealand', mode: 'insensitive' } },
        { teamA: { contains: 'Zeland', mode: 'insensitive' } },
        { teamB: { contains: 'Zeland', mode: 'insensitive' } }
      ]
    }
  });
  console.log('Found matches:', matches);
  await prisma.$disconnect();
}

main().catch(console.error);
