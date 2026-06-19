/**
 * src/services/groupService.ts
 * ─────────────────────────────────────────────────────────────────
 * Business logic for Group management.
 * Handles creation, joining, leaderboard, and activity feed.
 * ─────────────────────────────────────────────────────────────────
 */
import crypto from 'crypto';
import * as groupRepo from '../repositories/groupRepository';
import { AppError } from '../errors/AppError';

/**
 * Generates a cryptographically random 6-character uppercase
 * alphanumeric invite code. Uses crypto.randomBytes for security
 * (Math.random() is NOT safe for invite codes).
 *
 * Example output: "A3KP9Z"
 */
const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0/O/1/I to avoid confusion
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
};

/**
 * Create a new group.
 * - Generates a unique invite code (retries on collision, extremely rare)
 * - Automatically adds the creator as the first member
 * - Enforces one-group-per-user limit
 */
export const createGroup = async (
  creatorId: string,
  name: string,
): Promise<{
  id: string;
  name: string;
  inviteCode: string;
  creatorId: string;
  createdAt: Date;
}> => {
  // Enforce: a user can only be in one group at a time
  const existingGroup = await groupRepo.findUserGroup(creatorId);
  if (existingGroup) {
    throw new AppError(
      `You are already a member of "${existingGroup.name}". Leave it before creating a new group.`,
      409,
    );
  }

  // Generate a unique invite code (retry up to 5 times on collision)
  let inviteCode = '';
  let attempts = 0;
  while (attempts < 5) {
    const candidate = generateInviteCode();
    const existing = await groupRepo.findGroupByInviteCode(candidate);
    if (!existing) {
      inviteCode = candidate;
      break;
    }
    attempts++;
  }

  if (!inviteCode) {
    throw new AppError('Could not generate a unique invite code. Please try again.', 500, false);
  }

  // Create the group record
  const group = await groupRepo.createGroup({ name, inviteCode, creatorId });

  // Auto-join: add the creator as the first member
  await groupRepo.addMember(group.id, creatorId);

  return {
    id: group.id,
    name: group.name,
    inviteCode: group.inviteCode,
    creatorId: group.creatorId,
    createdAt: group.createdAt,
  };
};

/**
 * Join an existing group using an invite code.
 * Enforces the one-group-per-user limit and prevents duplicate joins.
 */
export const joinGroup = async (
  userId: string,
  inviteCode: string,
): Promise<{ groupId: string; groupName: string; inviteCode: string }> => {
  // Enforce: user can only be in one group
  const existingGroup = await groupRepo.findUserGroup(userId);
  if (existingGroup) {
    throw new AppError(
      `You are already a member of "${existingGroup.name}". Leave it before joining another.`,
      409,
    );
  }

  // Resolve the invite code to a group
  const group = await groupRepo.findGroupByInviteCode(inviteCode);
  if (!group) {
    throw new AppError('Invalid invite code. Please check and try again.', 404);
  }

  // Check if already a member (should be caught by existingGroup check above,
  // but double-checked here for safety against race conditions)
  const alreadyMember = await groupRepo.isMember(group.id, userId);
  if (alreadyMember) {
    throw new AppError('You are already a member of this group.', 409);
  }

  // Add the user to the group
  await groupRepo.addMember(group.id, userId);

  return { groupId: group.id, groupName: group.name, inviteCode: group.inviteCode };
};

/**
 * Get the leaderboard for a group.
 * Returns users sorted by total points earned descending.
 */
export const getLeaderboard = async (
  groupId: string,
  requestingUserId: string,
): Promise<
  Array<{
    rank: number;
    userId: string;
    username: string;
    totalPoints: number;
    isCurrentUser: boolean;
  }>
> => {
  // Verify the requesting user is a member of this group
  const isMember = await groupRepo.isMember(groupId, requestingUserId);
  if (!isMember) {
    throw new AppError('You are not a member of this group.', 403);
  }

  const leaderboard = await groupRepo.getLeaderboard(groupId);

  return leaderboard.map((entry) => ({
    ...entry,
    isCurrentUser: entry.userId === requestingUserId,
  }));
};

/**
 * Get the recent activity feed for a group.
 * Scores are hidden for matches that haven't kicked off yet.
 */
export const getGroupActivity = async (
  groupId: string,
  requestingUserId: string,
  limit?: number,
  offset?: number,
  userId?: string,
) => {
  // Verify membership
  const isMember = await groupRepo.isMember(groupId, requestingUserId);
  if (!isMember) {
    throw new AppError('You are not a member of this group.', 403);
  }

  // If userId filter is provided, verify they are in the group
  if (userId) {
    const targetIsMember = await groupRepo.isMember(groupId, userId);
    if (!targetIsMember) {
      throw new AppError('The filtered user is not a member of this group.', 404);
    }
  }

  return groupRepo.getGroupActivity(groupId, limit, offset, userId);
};



/**
 * Get dynamic comparison data of a target user's predictions for head-to-head views.
 */
export const comparePredictions = async (
  groupId: string,
  requestingUserId: string,
  targetUserId: string,
) => {
  const reqIsMember = await groupRepo.isMember(groupId, requestingUserId);
  if (!reqIsMember) {
    throw new AppError('You are not a member of this group.', 403);
  }

  const targetIsMember = await groupRepo.isMember(groupId, targetUserId);
  if (!targetIsMember) {
    throw new AppError('The target user is not a member of this group.', 404);
  }

  // 1. Check if requesting user is targeted by ROYAL_SPY (blocked from comparing)
  const activeDecree = await groupRepo.getActiveDecree(groupId);
  if (
    activeDecree &&
    activeDecree.activeDecreeType === 'ROYAL_SPY' &&
    activeDecree.activeDecreeTargetId === requestingUserId
  ) {
    throw new AppError('You are blocked from comparing picks by order of the Sheikh! 👀', 403);
  }

  // 2. Check if requesting user is the Sheikh AND the target user is targeted by ROYAL_SPY (allows spying on upcoming predictions)
  let showUpcoming = false;
  if (
    activeDecree &&
    activeDecree.activeDecreeType === 'ROYAL_SPY' &&
    activeDecree.activeDecreeTargetId === targetUserId
  ) {
    // Is requesting user the Sheikh?
    const leaderboard = await groupRepo.getLeaderboard(groupId);
    const sheikh = leaderboard.find((m) => m.isSheikh === true);
    if (sheikh && sheikh.userId === requestingUserId) {
      showUpcoming = true;
    }
  }

  return groupRepo.getUserPredictionsForComparison(targetUserId, showUpcoming);
};

/**
 * Get league-wide insights and statistics.
 */
export const getGroupInsights = async (
  groupId: string,
  requestingUserId: string,
) => {
  const isMember = await groupRepo.isMember(groupId, requestingUserId);
  if (!isMember) {
    throw new AppError('You are not a member of this group.', 403);
  }

  return groupRepo.getGroupInsights(groupId);
};

export const getAvailableDecreesForRound = async (groupId: string): Promise<string[]> => {
  const latestMatchId = await groupRepo.getLatestFinishedMatchId();
  const seedMatchId = latestMatchId || 'NO_FINISHED_MATCH';
  
  const allDecrees = ['TRANSFER_BAN', 'COMMUNITY_SERVICE', 'ROYAL_PARDON', 'LOYALTY_OATH', 'CLOWN_LOCK', 'ROYAL_SPY'];
  
  // Deterministic hash based on groupId and latest finished match
  const seed = `${groupId}_${seedMatchId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  hash = Math.abs(hash);

  const shuffled = [...allDecrees];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (hash + i) % (i + 1);
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  
  return shuffled.slice(0, 3);
};

export const getActiveDecree = async (groupId: string, requestingUserId: string) => {
  const isMember = await groupRepo.isMember(groupId, requestingUserId);
  if (!isMember) {
    throw new AppError('You are not a member of this group.', 403);
  }
  const activeDecree = await groupRepo.getActiveDecree(groupId);
  const availableDecrees = await getAvailableDecreesForRound(groupId);
  
  return {
    activeDecreeType: activeDecree?.activeDecreeType ?? null,
    activeDecreeTargetId: activeDecree?.activeDecreeTargetId ?? null,
    activeDecreeTargetName: activeDecree?.activeDecreeTargetName ?? null,
    activeDecreeBy: activeDecree?.activeDecreeBy ?? null,
    activeDecreeByName: activeDecree?.activeDecreeByName ?? null,
    activeDecreeAt: activeDecree?.activeDecreeAt ?? null,
    activeDecreeSigned: activeDecree?.activeDecreeSigned ?? false,
    activeDecreeComment: activeDecree?.activeDecreeComment ?? null,
    availableDecrees,
  };
};

export const issueDecree = async (
  groupId: string,
  requestingUserId: string,
  type: string,
  targetId?: string,
  comment?: string,
) => {
  // 1. Verify membership
  const isMember = await groupRepo.isMember(groupId, requestingUserId);
  if (!isMember) {
    throw new AppError('You are not a member of this group.', 403);
  }

  // 2. Verify the requesting user is the Round Sheikh
  const leaderboard = await groupRepo.getLeaderboard(groupId);
  const sheikh = leaderboard.find(m => m.isSheikh === true);
  if (!sheikh) {
    throw new AppError('Sheikh of the Round not determined.', 400);
  }
  if (sheikh.userId !== requestingUserId) {
    throw new AppError('Only the Round Sheikh can issue decrees!', 403);
  }

  // 3. Resolve usernames
  let targetName: string | null = null;
  if (targetId && targetId !== 'NONE') {
    targetName = await groupRepo.getUsername(targetId);
    if (!targetName) {
      throw new AppError('Target user not found.', 404);
    }
  }

  const byName = await groupRepo.getUsername(requestingUserId);

  // 4. Validate decree type is allowed this round
  const availableDecrees = await getAvailableDecreesForRound(groupId);
  const validTypes = [...availableDecrees, 'NONE'];
  if (!validTypes.includes(type)) {
    throw new AppError('Invalid decree type or not available this round.', 400);
  }

  // 5. Update group
  const data = {
    activeDecreeType: type === 'NONE' ? null : type,
    activeDecreeTargetId: type === 'NONE' ? null : (targetId || null),
    activeDecreeTargetName: type === 'NONE' ? null : targetName,
    activeDecreeBy: type === 'NONE' ? null : requestingUserId,
    activeDecreeByName: type === 'NONE' ? null : (byName || null),
    activeDecreeAt: type === 'NONE' ? null : new Date(),
    activeDecreeSigned: false,
    activeDecreeComment: type === 'LOYALTY_OATH' ? (comment || null) : null,
  };

  await groupRepo.updateGroupDecree(groupId, data);

  return { activeDecree: data };
};

export const swearAllegiance = async (
  groupId: string,
  requestingUserId: string,
  comment?: string,
) => {
  // 1. Verify membership
  const isMember = await groupRepo.isMember(groupId, requestingUserId);
  if (!isMember) {
    throw new AppError('You are not a member of this group.', 403);
  }

  // 2. Fetch active decree
  const activeDecree = await groupRepo.getActiveDecree(groupId);
  if (!activeDecree || activeDecree.activeDecreeType !== 'LOYALTY_OATH') {
    throw new AppError('No active Loyalty Oath decree found.', 400);
  }

  if (activeDecree.activeDecreeTargetId !== requestingUserId) {
    throw new AppError('You are not the target of the Loyalty Oath.', 403);
  }

  // 3. Update Group decree as signed
  const byName = activeDecree.activeDecreeByName || 'Sheikh';
  const defaultComment = `I, ${activeDecree.activeDecreeTargetName || 'the peasant'}, hereby swear absolute allegiance to Sheikh ${byName} and apologize for my absolute tactical incompetence! 📜👑`;
  const finalComment = comment && comment.trim() !== '' ? comment.trim() : defaultComment;

  await groupRepo.updateGroupDecree(groupId, {
    activeDecreeSigned: true,
    activeDecreeComment: finalComment,
  });

  return {
    activeDecreeType: activeDecree.activeDecreeType,
    activeDecreeTargetId: activeDecree.activeDecreeTargetId,
    activeDecreeTargetName: activeDecree.activeDecreeTargetName,
    activeDecreeBy: activeDecree.activeDecreeBy,
    activeDecreeByName: activeDecree.activeDecreeByName,
    activeDecreeAt: activeDecree.activeDecreeAt,
    activeDecreeSigned: true,
    activeDecreeComment: finalComment,
  };
};
