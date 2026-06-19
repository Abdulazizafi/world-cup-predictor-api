const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Deleting mock matches (externalId starts with "ext-")...');
  const deleteResult = await prisma.match.deleteMany({
    where: {
      externalId: {
        startsWith: 'ext-',
      },
    },
  });
  console.log(`✅ Deleted ${deleteResult.count} mock matches.`);

  // Verify what's left
  const totalMatches = await prisma.match.count();
  console.log(`📊 Remaining matches in database: ${totalMatches}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
