import { PrismaClient } from '@prisma/client';
import { getLeaderboard } from './src/repositories/groupRepository';

const prisma = new PrismaClient();

async function main() {
  const groups = await prisma.group.findMany({
    include: {
      members: {
        include: {
          user: true
        }
      }
    }
  });
  
  console.log(`Found ${groups.length} groups in database.`);
  
  for (const group of groups) {
    console.log(`\nGroup: ${group.name} (ID: ${group.id}, Invite: ${group.inviteCode})`);
    console.log(`Members count: ${group.members.length}`);
    
    // Fetch leaderboard for this group
    const leaderboard = await getLeaderboard(group.id);
    console.log('Leaderboard:');
    leaderboard.forEach(entry => {
      console.log(`- ${entry.username}: totalPoints: ${entry.totalPoints}, rank: ${entry.rank}, exact: ${entry.exactCount}, outcome: ${entry.outcomeCount}`);
    });
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
