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

export const getSheikhForRound = async (groupId: string): Promise<string | null> => {
  // 1. Find the latest finished match
  const latestFinishedMatch = await prisma.match.findFirst({
    where: { status: 'FINISHED' },
    orderBy: { matchTime: 'desc' },
    select: { matchTime: true },
  });
  
  if (!latestFinishedMatch) return null;
  
  // 2. Fetch matches finished within 24 hours of that match (defines the "round")
  const roundMatches = await prisma.match.findMany({
    where: {
      status: 'FINISHED',
      matchTime: {
        gte: new Date(latestFinishedMatch.matchTime.getTime() - 24 * 60 * 60 * 1000),
        lte: latestFinishedMatch.matchTime,
      },
    },
    select: { id: true },
  });
  
  const roundMatchIds = roundMatches.map(m => m.id);
  if (roundMatchIds.length === 0) return null;
  
  // 3. Fetch group member IDs
  const memberIds = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });
  const userIds = memberIds.map(m => m.userId);
  if (userIds.length === 0) return null;
  
  // 4. Sum up points earned for predictions in roundMatches per user
  const predictions = await prisma.prediction.findMany({
    where: {
      userId: { in: userIds },
      matchId: { in: roundMatchIds },
    },
    select: {
      userId: true,
      pointsEarned: true,
    },
  });
  
  const pointsMap = new Map<string, number>();
  userIds.forEach(uid => pointsMap.set(uid, 0));
  predictions.forEach(p => {
    pointsMap.set(p.userId, (pointsMap.get(p.userId) || 0) + p.pointsEarned);
  });
  
  // 5. Find user with max points
  let maxPoints = -1;
  let sheikhId: string | null = null;
  
  for (const [uid, pts] of pointsMap.entries()) {
    if (pts > maxPoints) {
      maxPoints = pts;
      sheikhId = uid;
    }
  }
  
  return sheikhId;
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
    isSheikh?: boolean;
  }>
> => {
  // Fetch group active decree
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      activeDecreeType: true,
      activeDecreeTargetId: true,
    },
  });

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
                select: {
                  status: true,
                  teamA: true,
                  teamB: true,
                  scoreA: true,
                  scoreB: true,
                },
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
        let earned = p.pointsEarned;

        // Apply Green Falcons Subsidy (+10 points)
        if (
          group?.activeDecreeType === 'GREEN_FALCONS' &&
          (p.match.teamA === 'Saudi Arabia' || p.match.teamB === 'Saudi Arabia')
        ) {
          const predictedKsaWin =
            (p.match.teamA === 'Saudi Arabia' && p.predictedScoreA > p.predictedScoreB) ||
            (p.match.teamB === 'Saudi Arabia' && p.predictedScoreB > p.predictedScoreA);

          const actualKsaWin =
            (p.match.teamA === 'Saudi Arabia' && (p.match.scoreA ?? 0) > (p.match.scoreB ?? 0)) ||
            (p.match.teamB === 'Saudi Arabia' && (p.match.scoreB ?? 0) > (p.match.scoreA ?? 0));

          if (predictedKsaWin && actualKsaWin) {
            earned += 10;
          }
        }

        totalPoints += earned;
        if (latestMatchId && p.matchId === latestMatchId) {
          // Exclude latest match points for trend baseline
        } else {
          prevPoints += earned;
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

    // Apply Royal Pardon (+5 points to all league members)
    if (group?.activeDecreeType === 'ROYAL_PARDON') {
      totalPoints += 5;
      prevPoints += 5;
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

  // 5. Sort by current points and assign rank, trend, and isSheikh
  const sortedMembers = [...memberData].sort((a, b) => b.totalPoints - a.totalPoints);
  
  let sheikhId = await getSheikhForRound(groupId);
  if (!sheikhId && sortedMembers.length > 0) {
    sheikhId = sortedMembers[0].userId;
  }
  
  if (sheikhId) {
    await prisma.group.update({
      where: { id: groupId },
      data: { sheikhUserId: sheikhId },
    });
  }

  const leaderboard = sortedMembers.map((entry, index) => {
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
      isSheikh: entry.userId === sheikhId,
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
  userId?: string,
): Promise<
  Array<{
    username: string;
    matchId?: string;
    teamA?: string;
    teamB?: string;
    matchTime?: Date;
    status?: string;
    predictedScoreA?: number | null; // null = hidden (pre-kickoff)
    predictedScoreB?: number | null;
    pointsEarned?: number;
    useDoublePoints?: boolean;
    scoreA?: number | null;
    scoreB?: number | null;
    createdAt: Date;
    isLoyaltyOath?: boolean;
    commentText?: string;
    sheikhName?: string;
  }>
> => {
  const now = new Date();

  // Fetch the group's active decree to see if we should inject the Loyalty Oath comment
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      activeDecreeType: true,
      activeDecreeTargetId: true,
      activeDecreeTargetName: true,
      activeDecreeByName: true,
      activeDecreeSigned: true,
      activeDecreeComment: true,
      activeDecreeAt: true,
    },
  });

  const loyaltyOathItem =
    group &&
    group.activeDecreeType === 'LOYALTY_OATH' &&
    group.activeDecreeSigned &&
    (!userId || userId === group.activeDecreeTargetId)
      ? {
          username: group.activeDecreeTargetName!,
          createdAt: group.activeDecreeAt || new Date(),
          isLoyaltyOath: true,
          commentText: group.activeDecreeComment || `Swore allegiance to Sheikh ${group.activeDecreeByName}`,
          sheikhName: group.activeDecreeByName || 'Sheikh',
        }
      : null;

  const memberIds = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });

  const userIds = memberIds.map((m) => m.userId);
  const filterUserIds = userId && userIds.includes(userId) ? [userId] : userIds;

  const predictions = await prisma.prediction.findMany({
    where: { userId: { in: filterUserIds } },
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

  const mapped = predictions.map((p) => {
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

  if (loyaltyOathItem && (!offset || offset === 0)) {
    return [loyaltyOathItem, ...mapped];
  }
  return mapped;
};

/**
 * Fetch a user's predictions.
 * If showUpcoming is false, hides predictions for matches that haven't kicked off.
 */
export const getUserPredictionsForComparison = async (
  userId: string,
  showUpcoming: boolean = false,
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
      match: showUpcoming ? undefined : {
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
  maxPointsUsername: string | null;
  upsetMatch: { teamA: string; teamB: string; averagePoints: number } | null;
}> => {
  // 1. Get all members in the group
  const memberIds = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });
  const userIds = memberIds.map((m) => m.userId);

  if (userIds.length === 0) {
    return { averagePoints: 0, maxPointsEarned: 0, maxPointsUsername: null, upsetMatch: null };
  }

  // 2. Average points in league
  const leaderboard = await getLeaderboard(groupId);
  const totalLeaguePoints = leaderboard.reduce((sum, u) => sum + u.totalPoints, 0);
  const averagePoints = leaderboard.length > 0 ? Math.round(totalLeaguePoints / leaderboard.length) : 0;

  // 3. Max points earned in a single prediction
  const maxPrediction = await prisma.prediction.findFirst({
    where: { userId: { in: userIds }, match: { status: 'FINISHED' } },
    orderBy: { pointsEarned: 'desc' },
    select: {
      pointsEarned: true,
      user: { select: { username: true } },
    },
  });
  const maxPointsEarned = maxPrediction?.pointsEarned || 0;
  const maxPointsUsername = maxPrediction?.user?.username || null;

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
    maxPointsUsername,
    upsetMatch,
  };
};

export const isUserTransferBanned = async (userId: string): Promise<boolean> => {
  const activeBan = await prisma.group.findFirst({
    where: {
      activeDecreeType: 'TRANSFER_BAN',
      activeDecreeTargetId: userId,
    },
  });
  return activeBan !== null;
};

export const updateGroupDecree = async (
  groupId: string,
  data: Partial<{
    activeDecreeType: string | null;
    activeDecreeTargetId: string | null;
    activeDecreeTargetName: string | null;
    activeDecreeBy: string | null;
    activeDecreeByName: string | null;
    activeDecreeAt: Date | null;
    activeDecreeSigned: boolean;
    activeDecreeComment: string | null;
  }>
) => {
  return prisma.group.update({
    where: { id: groupId },
    data,
  });
};

export const getUsername = async (userId: string): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  return user?.username ?? null;
};

export const getActiveDecree = async (groupId: string) => {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      activeDecreeType: true,
      activeDecreeTargetId: true,
      activeDecreeTargetName: true,
      activeDecreeBy: true,
      activeDecreeByName: true,
      activeDecreeAt: true,
      activeDecreeSigned: true,
      activeDecreeComment: true,
    },
  });
  if (!group || !group.activeDecreeType) return null;
  return group;
};

export const getLatestFinishedMatchId = async (): Promise<string | null> => {
  const match = await prisma.match.findFirst({
    where: { status: 'FINISHED' },
    orderBy: { matchTime: 'desc' },
    select: { id: true },
  });
  return match?.id ?? null;
};
