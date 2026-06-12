/**
 * src/services/authService.ts
 * ─────────────────────────────────────────────────────────────────
 * Business logic for authentication.
 * Handles registration, login, logout, and current user retrieval.
 * Coordinates between the user repository, bcrypt, and JWT signing.
 * ─────────────────────────────────────────────────────────────────
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import * as userRepo from '../repositories/userRepository';
import * as groupRepo from '../repositories/groupRepository';
import { AppError } from '../errors/AppError';
import { env } from '../config/env';

/** Salt rounds for bcrypt. Higher = slower brute-force, but slower hashing. */
const SALT_ROUNDS = 10;

/** JWT cookie name — consistent across set and clear operations */
export const JWT_COOKIE_NAME = 'wcp_token';

/** JWT token lifetime */
const JWT_EXPIRES_IN = '7d';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * Signs a JWT and attaches it as a secure HttpOnly cookie to the response.
 * Centralised here to ensure consistent cookie settings everywhere.
 */
const issueAuthCookie = (res: Response, userId: string, username: string): void => {
  const token = jwt.sign({ id: userId, username }, env.JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  res.cookie(JWT_COOKIE_NAME, token, {
    httpOnly: true,                                  // Prevents JS access (XSS protection)
    secure: env.NODE_ENV === 'production',           // HTTPS only in production
    sameSite: 'strict',                              // CSRF protection
    maxAge: COOKIE_MAX_AGE,
  });
};

/**
 * Register a new user.
 * Checks for username uniqueness, hashes the password, creates the record,
 * and issues a JWT cookie so the user is immediately logged in.
 */
export const register = async (
  res: Response,
  username: string,
  password: string,
): Promise<{
  id: string;
  username: string;
  createdAt: Date;
  groupId: string | null;
  groupName: string | null;
  inviteCode: string | null;
}> => {
  // 1. Check if username already taken
  const existing = await userRepo.findByUsername(username);
  if (existing) {
    throw new AppError('This username is already taken. Please choose another.', 409);
  }

  // 2. Hash the password (never store plain text)
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // 3. Persist the new user
  const user = await userRepo.createUser({ username, passwordHash });

  // 4. Issue JWT cookie — user is automatically logged in after registering
  issueAuthCookie(res, user.id, user.username);

  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    groupId: null,
    groupName: null,
    inviteCode: null,
  };
};

/**
 * Log in an existing user.
 * Validates credentials and issues a fresh JWT cookie.
 */
export const login = async (
  res: Response,
  username: string,
  password: string,
): Promise<{
  id: string;
  username: string;
  createdAt: Date;
  groupId: string | null;
  groupName: string | null;
  inviteCode: string | null;
}> => {
  // 1. Find the user (don't reveal whether the user exists for security)
  const user = await userRepo.findByUsername(username);
  if (!user) {
    throw new AppError('Invalid username or password.', 401);
  }

  // 2. Constant-time bcrypt comparison (prevents timing attacks)
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid username or password.', 401);
  }

  // 3. Issue JWT cookie
  issueAuthCookie(res, user.id, user.username);

  // 4. Resolve group membership
  const group = await groupRepo.findUserGroup(user.id);

  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    groupId: group?.id ?? null,
    groupName: group?.name ?? null,
    inviteCode: group?.inviteCode ?? null,
  };
};

/**
 * Clear the auth cookie to log out the user.
 */
export const logout = (res: Response): void => {
  res.clearCookie(JWT_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
};

/**
 * Get the current authenticated user's profile.
 * Includes their group ID if they've joined a group.
 */
export const getMe = async (
  userId: string,
): Promise<{
  id: string;
  username: string;
  createdAt: Date;
  groupId: string | null;
  groupName: string | null;
  inviteCode: string | null;
}> => {
  const user = await userRepo.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  // Resolve the user's group membership (if any)
  const group = await groupRepo.findUserGroup(userId);

  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    groupId: group?.id ?? null,
    groupName: group?.name ?? null,
    inviteCode: group?.inviteCode ?? null,
  };
};
