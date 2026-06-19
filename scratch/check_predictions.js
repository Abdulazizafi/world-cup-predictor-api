const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const totalPredictions = await prisma.prediction.count();
    console.log('Total predictions in entire database:', totalPredictions);

    const groups = await prisma.group.findMany();
    for (const g of groups) {
      const members = await prisma.groupMember.findMany({
        where: { groupId: g.id },
        select: { userId: true }
      });
      const userIds = members.map(m => m.userId);
      const groupPredCount = await prisma.prediction.count({
        where: { userId: { in: userIds } }
      });
      console.log(`Group: ${g.name} (${g.id}) has ${groupPredCount} predictions.`);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
