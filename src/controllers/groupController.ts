/**
 * src/controllers/groupController.ts
 * ─────────────────────────────────────────────────────────────────
 * HTTP handlers for Group management endpoints.
 * ─────────────────────────────────────────────────────────────────
 */
import { Request, Response, NextFunction } from 'express';
import * as groupService from '../services/groupService';
import { CreateGroupInput, JoinGroupInput } from '../schemas/group.schema';

/**
 * POST /api/groups/create
 * Creates a new private league and auto-joins the creator.
 */
export const createGroup = async (
  req: Request<object, object, CreateGroupInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const group = await groupService.createGroup(req.user!.id, req.body.name);

    res.status(201).json({
      status: 'success',
      message: `Group "${group.name}" created! Share the invite code: ${group.inviteCode}`,
      data: { group },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/groups/join
 * Joins the authenticated user to a group by invite code.
 */
export const joinGroup = async (
  req: Request<object, object, JoinGroupInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await groupService.joinGroup(req.user!.id, req.body.inviteCode);

    res.status(200).json({
      status: 'success',
      message: `You joined "${result.groupName}" successfully!`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/groups/:groupId/leaderboard
 * Returns the group's standings sorted by total points.
 */
export const getLeaderboard = async (
  req: Request<{ groupId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const leaderboard = await groupService.getLeaderboard(
      req.params.groupId,
      req.user!.id,
    );

    res.status(200).json({
      status: 'success',
      data: { leaderboard },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/groups/:groupId/activity
 * Returns the recent prediction activity feed for the group.
 * Exact scores are hidden for upcoming matches.
 */
export const getGroupActivity = async (
  req: Request<{ groupId: string }, any, any, { limit?: string; offset?: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : undefined;

    const activity = await groupService.getGroupActivity(
      req.params.groupId,
      req.user!.id,
      limit,
      offset,
    );

    res.status(200).json({
      status: 'success',
      data: { activity },
    });
  } catch (err) {
    next(err);
  }
};
