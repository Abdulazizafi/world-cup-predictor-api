const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Connected!');

    // 1. List all groups
    const groups = await prisma.group.findMany({
      include: {
        members: true
      }
    });
    console.log('Groups in database:');
    for (const g of groups) {
      console.log(`- ID: ${g.id}, Name: ${g.name}, Members: ${g.members.length}`);
    }

    if (groups.length === 0) {
      console.log('No groups found.');
      return;
    }

    const targetGroupId = groups[0].id;
    console.log(`\nTesting getGroupInsights for group: ${targetGroupId} (${groups[0].name})`);

    // Let's implement the getGroupInsights logic to test it
    const memberIds = await prisma.groupMember.findMany({
      where: { groupId: targetGroupId },
      select: { userId: true },
    });
    const userIds = memberIds.map((m) => m.userId);
    console.log(`Members userIds:`, userIds);

    if (userIds.length === 0) {
      console.log('No members in group.');
      return;
    }

    // Average points in league
    // Query points using leaderboard logic
    const members = await prisma.groupMember.findMany({
      where: { groupId: targetGroupId },
      include: {
        user: {
          include: {
            predictions: {
              include: {
                match: {
                  select: { status: true },
                },
              },
            },
          },
        },
      },
    });

    console.log(`Fetched ${members.length} members details.`);
    
    // Max points earned in a single prediction
    const maxPrediction = await prisma.prediction.findFirst({
      where: { userId: { in: userIds }, match: { status: 'FINISHED' } },
      orderBy: { pointsEarned: 'desc' },
      select: {
        pointsEarned: true,
        user: { select: { username: true } },
      },
    });
    console.log(`Max prediction result:`, maxPrediction);

    // Upset Match
    const finishedMatches = await prisma.match.findMany({
      where: { status: 'FINISHED' },
      select: { id: true, teamA: true, teamB: true },
    });
    console.log(`Finished matches count:`, finishedMatches.length);

    console.log('Insights logic completed successfully!');
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
