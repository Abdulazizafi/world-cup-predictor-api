/**
 * src/utils/probabilityEngine.ts
 * ─────────────────────────────────────────────────────────────────
 * Deterministic & Stable Win Probability Engine.
 * ─────────────────────────────────────────────────────────────────
 */

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

const TEAM_RATINGS: Record<string, number> = {
  // Top Tier
  'ARGENTINA': 88,
  'FRANCE': 87,
  'BRAZIL': 87,
  'ENGLAND': 86,
  'SPAIN': 85,
  'PORTUGAL': 84,
  'GERMANY': 84,
  'BELGIUM': 84,

  // Mid Tier
  'NETHERLANDS': 83,
  'ITALY': 82,
  'URUGUAY': 81,
  'CROATIA': 80,
  'MOROCCO': 80,
  'USA': 78,
  'JAPAN': 78,
  'NORWAY': 78,
  'MEXICO': 77,
  'SENEGAL': 77,
  'SWEDEN': 77,
  'AUSTRIA': 77,
  'SOUTH KOREA': 76,
  'BOSNIA': 76,
  'CANADA': 75,
  'AUSTRALIA': 74,

  // Underdogs
  'COLOMBIA': 73,
  'SAUDI ARABIA': 72,
  'IRAN': 72,
  'ECUADOR': 72,
  'IVORY COAST': 72,
  'TUNISIA': 71,
  'PARAGUAY': 71,
  'CONGO': 70,
  'CAPE VERDE': 70,
  'CURAÇAO': 68,
};

export function getTeamRating(teamName: string): number {
  const normalized = teamName.trim().toUpperCase();
  if (TEAM_RATINGS[normalized] !== undefined) {
    return TEAM_RATINGS[normalized];
  }
  // Generate stable rating between 68 and 80 based on the hash of the team name
  const hash = hashString(normalized);
  return 68 + (hash % 13);
}

export function getMatchProbabilities(match: {
  teamA: string;
  teamB: string;
  externalId: string;
}): { probA: number; probB: number; probDraw: number } {
  const ratingA = getTeamRating(match.teamA);
  const ratingB = getTeamRating(match.teamB);
  
  const D = ratingA - ratingB;
  
  // Stable noise using match externalId hash
  const hashVal = hashString(match.externalId);
  const noiseA = ((hashVal % 11) - 5) / 100; // -0.05 to +0.05
  const noiseB = (((hashVal >> 4) % 11) - 5) / 100; // -0.05 to +0.05
  
  let rawA = 0.38 + D * 0.015 + noiseA;
  let rawB = 0.38 - D * 0.015 + noiseB;
  let rawDraw = 0.24 - (noiseA + noiseB);
  
  // Clamps to ensure realistic ranges
  rawA = Math.max(0.15, Math.min(0.80, rawA));
  rawB = Math.max(0.15, Math.min(0.80, rawB));
  rawDraw = Math.max(0.12, Math.min(0.40, rawDraw));
  
  // Normalize
  const total = rawA + rawB + rawDraw;
  let probA = Math.round((rawA / total) * 100);
  let probB = Math.round((rawB / total) * 100);
  let probDraw = 100 - probA - probB;
  
  return { probA, probB, probDraw };
}
