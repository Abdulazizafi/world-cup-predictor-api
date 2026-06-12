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
) => {
  // Verify membership
  const isMember = await groupRepo.isMember(groupId, requestingUserId);
  if (!isMember) {
    throw new AppError('You are not a member of this group.', 403);
  }

  return groupRepo.getGroupActivity(groupId);
};
