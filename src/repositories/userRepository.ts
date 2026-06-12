/**
 * src/repositories/userRepository.ts
 * ─────────────────────────────────────────────────────────────────
 * Data access layer for the User model.
 * All database queries for users are centralised here.
 * Services never call Prisma directly — they go through repositories.
 * ─────────────────────────────────────────────────────────────────
 */
import { PrismaClient, User } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Find a user by their unique username (case-sensitive in SQLite).
 * Used during login to look up the user before password comparison.
 */
export const findByUsername = async (
  username: string,
): Promise<User | null> => {
  return prisma.user.findUnique({
    where: { username },
  });
};

/**
 * Find a user by their UUID primary key.
 * Used by the `authenticate` middleware and GET /api/auth/me.
 */
export const findById = async (id: string): Promise<User | null> => {
  return prisma.user.findUnique({
    where: { id },
  });
};

/**
 * Create a new user record.
 * Password must already be hashed before calling this function.
 */
export const createUser = async (data: {
  username: string;
  passwordHash: string;
}): Promise<User> => {
  return prisma.user.create({ data });
};
