/**
 * src/repositories/matchRepository.ts
 * ─────────────────────────────────────────────────────────────────
 * Data access layer for the Match model.
 * Matches are populated and kept up-to-date by the SyncService.
 * ─────────────────────────────────────────────────────────────────
 */
import { PrismaClient, Match } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Find a match by its internal UUID.
 * Used by the prediction service to validate the matchId.
 */
export const findMatchById = async (id: string): Promise<Match | null> => {
  return prisma.match.findUnique({ where: { id } });
};

/**
 * Find a match by its external API ID (worldcup26.ir match ID).
 * Used by the SyncService to detect existing records before upserting.
 */
export const findMatchByExternalId = async (
  externalId: string,
): Promise<Match | null> => {
  return prisma.match.findUnique({ where: { externalId } });
};

/**
 * Retrieve all matches, ordered by kickoff time ascending.
 * Optionally include each match's predictions for a specific user.
 */
export const getAllMatches = async (
  userId?: string,
): Promise<
  Array<
    Match & {
      userPrediction: {
        predictedScoreA: number;
        predictedScoreB: number;
        pointsEarned: number;
      } | null;
    }
  >
> => {
  const matches = await prisma.match.findMany({
    orderBy: { matchTime: 'asc' },
    include: userId
      ? {
          predictions: {
            where: { userId },
            select: {
              predictedScoreA: true,
              predictedScoreB: true,
              pointsEarned: true,
            },
          },
        }
      : undefined,
  });

  // Flatten the predictions array into a single userPrediction object
  return matches.map((match) => {
    const predictions =
      (match as Match & { predictions?: { predictedScoreA: number; predictedScoreB: number; pointsEarned: number }[] })
        .predictions ?? [];
    const { predictions: _p, ...matchWithoutPredictions } = match as Match & { predictions?: unknown[] };
    void _p;
    return {
      ...matchWithoutPredictions,
      userPrediction: predictions.length > 0 ? predictions[0] : null,
    };
  });
};

/**
 * Upsert a match using its externalId as the conflict key.
 * Called by the SyncService on every sync cycle.
 */
export const upsertMatch = async (data: {
  externalId: string;
  teamA: string;
  teamB: string;
  teamAFlag?: string | null;
  teamBFlag?: string | null;
  matchTime: Date;
  status: string;
  scoreA?: number | null;
  scoreB?: number | null;
  stage: string;
  venue?: string | null;
}): Promise<Match> => {
  return prisma.match.upsert({
    where: { externalId: data.externalId },
    update: {
      status: data.status,
      scoreA: data.scoreA,
      scoreB: data.scoreB,
      matchTime: data.matchTime,
      teamA: data.teamA,
      teamB: data.teamB,
      teamAFlag: data.teamAFlag,
      teamBFlag: data.teamBFlag,
      stage: data.stage,
      venue: data.venue,
    },
    create: data,
  });
};

/**
 * Find all matches that currently have LIVE status.
 * Used by the SyncService to decide on a faster polling interval.
 */
export const findLiveMatches = async (): Promise<Match[]> => {
  return prisma.match.findMany({
    where: { status: 'LIVE' },
  });
};
