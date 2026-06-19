const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  console.log(`COUNT_USERS:${count}`);
  const users = await prisma.user.findMany({ select: { username: true, createdAt: true } });
  console.log('USERS:', JSON.stringify(users));
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
