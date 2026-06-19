const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const matches = await prisma.match.findMany();
  const teams = new Set();
  matches.forEach(m => {
    teams.add(m.teamA);
    teams.add(m.teamB);
  });
  console.log(JSON.stringify(Array.from(teams).sort()));
}
main().catch(console.error).finally(() => prisma.$disconnect());
