/**
 * src/repositories/groupRepository.ts
 * ─────────────────────────────────────────────────────────────────
 * Data access layer for Group and GroupMember models.
 * ─────────────────────────────────────────────────────────────────
 */
import { PrismaClient, Group, GroupMember } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Find a group by its unique invite code.
 * Used during the join flow to resolve the code to a group ID.
 */
export const findGroupByInviteCode = async (
  inviteCode: string,
): Promise<Group | null> => {
  return prisma.group.findUnique({
    where: { inviteCode },
  });
};

/**
 * Find a group by its primary key.
 * Used for leaderboard and activity feed lookups.
 */
export const findGroupById = async (id: string): Promise<Group | null> => {
  return prisma.group.findUnique({
    where: { id },
  });
};

/**
 * Create a new group.
 */
export const createGroup = async (data: {
  name: string;
  inviteCode: string;
  creatorId: string;
}): Promise<Group> => {
  return prisma.group.create({ data });
};

/**
 * Add a user to a group.
 * Relies on the @@unique([groupId, userId]) constraint to prevent
 * duplicate memberships at the database level.
 */
export const addMember = async (
  groupId: string,
  userId: string,
): Promise<GroupMember> => {
  return prisma.groupMember.create({
    data: { groupId, userId },
  });
};

/**
 * Check if a user is already a member of a specific group.
 */
export const isMember = async (
  groupId: string,
  userId: string,
): Promise<boolean> => {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  return membership !== null;
};

/**
 * Find the group a user belongs to (users can only be in one group).
 * Returns null if the user hasn't joined any group yet.
 */
export const findUserGroup = async (
  userId: string,
): Promise<Group | null> => {
  const membership = await prisma.groupMember.findFirst({
    where: { userId },
    include: { group: true },
  });
  return membership?.group ?? null;
};

/**
 * Get all members of a group with their user details and total points.
 * Used for leaderboard calculation.
 * Returns members sorted by total points descending.
 */
export const getLeaderboard = async (
  groupId: string,
): Promise<
  Array<{
    userId: string;
    username: string;
    totalPoints: number;
    rank: number;
  }>
> => {
  // Fetch all members with their predictions' points
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: {
      user: {
        include: {
          predictions: {
            select: { pointsEarned: true },
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });

  // Aggregate points and sort
  const leaderboard = members
    .map((m) => ({
      userId: m.userId,
      username: m.user.username,
      totalPoints: m.user.predictions.reduce(
        (sum, p) => sum + (p.pointsEarned ?? 0),
        0,
      ),
      rank: 0, // assigned after sort
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return leaderboard;
};

/**
 * Get recent prediction activity for all members of a group.
 * Returns the 20 most recent predictions across all group members.
 * Scores are hidden for matches that haven't kicked off yet.
 */
export const getGroupActivity = async (
  groupId: string,
  limit?: number,
  offset?: number,
): Promise<
  Array<{
    username: string;
    matchId: string;
    teamA: string;
    teamB: string;
    matchTime: Date;
    status: string;
    predictedScoreA: number | null; // null = hidden (pre-kickoff)
    predictedScoreB: number | null;
    pointsEarned: number;
    useDoublePoints: boolean;
    scoreA: number | null;
    scoreB: number | null;
    createdAt: Date;
  }>
> => {
  const now = new Date();

  const memberIds = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });

  const userIds = memberIds.map((m) => m.userId);

  const predictions = await prisma.prediction.findMany({
    where: { userId: { in: userIds } },
    include: {
      user: { select: { username: true } },
      match: {
        select: {
          id: true,
          teamA: true,
          teamB: true,
          matchTime: true,
          status: true,
          scoreA: true,
          scoreB: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit ?? 20,
    skip: offset ?? 0,
  });

  return predictions.map((p) => {
    // Hide exact scores if the match hasn't started yet (anti-cheat)
    const isUpcoming = p.match.matchTime > now;

    return {
      username: p.user.username,
      matchId: p.match.id,
      teamA: p.match.teamA,
      teamB: p.match.teamB,
      matchTime: p.match.matchTime,
      status: p.match.status,
      predictedScoreA: isUpcoming ? null : p.predictedScoreA,
      predictedScoreB: isUpcoming ? null : p.predictedScoreB,
      pointsEarned: isUpcoming ? 0 : p.pointsEarned,
      useDoublePoints: p.useDoublePoints,
      scoreA: p.match.status === 'FINISHED' ? p.match.scoreA : null,
      scoreB: p.match.status === 'FINISHED' ? p.match.scoreB : null,
      createdAt: p.createdAt,
    };
  });
};
