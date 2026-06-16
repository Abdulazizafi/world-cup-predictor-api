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
    trend: 'UP' | 'DOWN' | 'SAME';
    exactCount: number;
    outcomeCount: number;
    incorrectCount: number;
    doubleUsed: number;
  }>
> => {
  // 1. Get latest finished match to compute rank shifts/trends
  const latestFinishedMatch = await prisma.match.findFirst({
    where: { status: 'FINISHED' },
    orderBy: { matchTime: 'desc' },
    select: { id: true },
  });
  const latestMatchId = latestFinishedMatch?.id || null;

  // 2. Fetch all members with predictions and match status
  const members = await prisma.groupMember.findMany({
    where: { groupId },
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
    orderBy: { joinedAt: 'asc' },
  });

  // 3. Compute stats, total points, and previous points
  const memberData = members.map((m) => {
    let exactCount = 0;
    let outcomeCount = 0;
    let incorrectCount = 0;
    let doubleUsed = 0;
    let totalPoints = 0;
    let prevPoints = 0;

    for (const p of m.user.predictions) {
      if (p.useDoublePoints) {
        doubleUsed++;
      }
      if (p.match.status === 'FINISHED') {
        totalPoints += p.pointsEarned;
        if (latestMatchId && p.matchId === latestMatchId) {
          // Exclude latest match points for trend baseline
        } else {
          prevPoints += p.pointsEarned;
        }

        if (p.pointsEarned === 100 || p.pointsEarned === 200) {
          exactCount++;
        } else if (p.pointsEarned === 40 || p.pointsEarned === 80) {
          outcomeCount++;
        } else if (p.pointsEarned === 0) {
          incorrectCount++;
        }
      }
    }

    return {
      userId: m.userId,
      username: m.user.username,
      totalPoints,
      prevPoints,
      exactCount,
      outcomeCount,
      incorrectCount,
      doubleUsed,
    };
  });

  // 4. Determine previous ranks
  const prevRankings = [...memberData]
    .sort((a, b) => b.prevPoints - a.prevPoints)
    .map((entry, index) => ({ userId: entry.userId, rank: index + 1 }));
  const prevRankMap = new Map(prevRankings.map((r) => [r.userId, r.rank]));

  // 5. Sort by current points and assign rank and trend
  const leaderboard = memberData
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((entry, index) => {
      const currentRank = index + 1;
      const prevRank = prevRankMap.get(entry.userId) || currentRank;
      
      let trend: 'UP' | 'DOWN' | 'SAME' = 'SAME';
      if (latestMatchId) { // Only calculate trends if at least one match has finished
        if (prevRank > currentRank) trend = 'UP';
        else if (prevRank < currentRank) trend = 'DOWN';
      }

      return {
        userId: entry.userId,
        username: entry.username,
        totalPoints: entry.totalPoints,
        rank: currentRank,
        trend,
        exactCount: entry.exactCount,
        outcomeCount: entry.outcomeCount,
        incorrectCount: entry.incorrectCount,
        doubleUsed: entry.doubleUsed,
      };
    });

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

/**
 * Fetch a user's predictions for matches that have already kicked off.
 * Used for head-to-head comparison without allowing anti-cheat bypass.
 */
export const getUserPredictionsForComparison = async (
  userId: string,
): Promise<
  Array<{
    matchId: string;
    predictedScoreA: number;
    predictedScoreB: number;
    pointsEarned: number;
    useDoublePoints: boolean;
  }>
> => {
  const now = new Date();

  const predictions = await prisma.prediction.findMany({
    where: {
      userId,
      match: {
        matchTime: { lte: now }, // only matches that have kicked off
      },
    },
    select: {
      matchId: true,
      predictedScoreA: true,
      predictedScoreB: true,
      pointsEarned: true,
      useDoublePoints: true,
    },
  });

  return predictions;
};

/**
 * Get group-level statistics and league-wide insights.
 */
export const getGroupInsights = async (
  groupId: string,
): Promise<{
  averagePoints: number;
  maxPointsEarned: number;
  upsetMatch: { teamA: string; teamB: string; averagePoints: number } | null;
}> => {
  // 1. Get all members in the group
  const memberIds = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });
  const userIds = memberIds.map((m) => m.userId);

  if (userIds.length === 0) {
    return { averagePoints: 0, maxPointsEarned: 0, upsetMatch: null };
  }

  // 2. Average points in league
  const leaderboard = await getLeaderboard(groupId);
  const totalLeaguePoints = leaderboard.reduce((sum, u) => sum + u.totalPoints, 0);
  const averagePoints = leaderboard.length > 0 ? Math.round(totalLeaguePoints / leaderboard.length) : 0;

  // 3. Max points earned in a single prediction
  const maxPrediction = await prisma.prediction.findFirst({
    where: { userId: { in: userIds }, match: { status: 'FINISHED' } },
    orderBy: { pointsEarned: 'desc' },
    select: { pointsEarned: true },
  });
  const maxPointsEarned = maxPrediction?.pointsEarned || 0;

  // 4. Upset Match (finished match with the lowest average points earned)
  const finishedMatches = await prisma.match.findMany({
    where: { status: 'FINISHED' },
    select: { id: true, teamA: true, teamB: true },
  });

  let upsetMatch: { teamA: string; teamB: string; averagePoints: number } | null = null;
  let lowestAverage = 999;

  for (const match of finishedMatches) {
    const predictions = await prisma.prediction.findMany({
      where: { matchId: match.id, userId: { in: userIds } },
      select: { pointsEarned: true },
    });

    if (predictions.length > 0) {
      const avg = predictions.reduce((sum, p) => sum + p.pointsEarned, 0) / predictions.length;
      if (avg < lowestAverage) {
        lowestAverage = avg;
        upsetMatch = {
          teamA: match.teamA,
          teamB: match.teamB,
          averagePoints: Math.round(avg * 10) / 10,
        };
      }
    }
  }

  return {
    averagePoints,
    maxPointsEarned,
    upsetMatch,
  };
};
