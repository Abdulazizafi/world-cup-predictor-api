/**
 * src/services/syncService.ts
 * ─────────────────────────────────────────────────────────────────
 * External Data Sync Service — worldcup26.ir Integration.
 *
 * Responsibilities:
 *   1. Fetch match data from the worldcup26.ir public API
 *   2. Upsert matches into the local database (by externalId)
 *   3. Detect matches that just transitioned to FINISHED
 *   4. Trigger the Points Engine for newly finished matches
 *   5. Run on an adaptive interval (faster when live matches exist)
 *
 * This service REPLACES the manual admin endpoint — no human
 * intervention is needed to update scores or trigger points.
 * ─────────────────────────────────────────────────────────────────
 */
import axios, { AxiosError } from 'axios';
import * as matchRepo from '../repositories/matchRepository';
import { calculatePoints } from './pointsEngine';
import { env } from '../config/env';
import { Match } from '@prisma/client';

// ─── External API Response Types ────────────────────────────────────────────

/**
 * Represents a single match object as returned by the worldcup26.ir API.
 * Field names are mapped from the API's response structure.
 */
interface WC26ApiMatch {
  id: string | number;
  home_team?: { name?: string; flag?: string; name_code?: string };
  away_team?: { name?: string; flag?: string; name_code?: string };
  home?: { name?: string; flag?: string; code?: string };    // alternate shape
  away?: { name?: string; flag?: string; code?: string };
  local_date?: string;                                        // ISO datetime string
  date?: string;
  time?: string;
  home_score?: number | string | null;
  away_score?: number | string | null;
  status?: string;                                            // "scheduled","live","completed"
  stage_name?: string;
  group?: string;
  venue?: string;
  stadium?: { name?: string };

  // Real API fields
  home_team_name_en?: string;
  away_team_name_en?: string;
  finished?: string;
  time_elapsed?: string;
  type?: string;
  stadium_id?: string | number;
}

interface WC26ApiResponse {
  games?: WC26ApiMatch[];
  matches?: WC26ApiMatch[];
  data?: WC26ApiMatch[];
  results?: WC26ApiMatch[];
}

const DEFAULT_MOCKED_WC26_MATCHES: WC26ApiMatch[] = [
  {
    id: 'ext-1',
    home_team: { name: 'USA', flag: '🇺🇸' },
    away_team: { name: 'Mexico', flag: '🇲🇽' },
    local_date: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    status: 'scheduled',
    stage_name: 'Group A',
    venue: 'AT&T Stadium, Dallas',
  },
  {
    id: 'ext-2',
    home_team: { name: 'Brazil', flag: '🇧🇷' },
    away_team: { name: 'Argentina', flag: '🇦🇷' },
    local_date: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
    status: 'scheduled',
    stage_name: 'Group B',
    venue: 'Rose Bowl, LA',
  },
  {
    id: 'ext-3',
    home_team: { name: 'France', flag: '🇫🇷' },
    away_team: { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    local_date: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: 'live',
    home_score: 1,
    away_score: 1,
    stage_name: 'Group C',
    venue: 'SoFi Stadium, Inglewood',
  },
  {
    id: 'ext-4',
    home_team: { name: 'Germany', flag: '🇩🇪' },
    away_team: { name: 'Spain', flag: '🇪🇸' },
    local_date: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    status: 'completed',
    home_score: 2,
    away_score: 1,
    stage_name: 'Group D',
    venue: 'MetLife Stadium, NJ',
  },
  {
    id: 'ext-5',
    home_team: { name: 'Portugal', flag: '🇵🇹' },
    away_team: { name: 'Belgium', flag: '🇧🇪' },
    local_date: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    status: 'completed',
    home_score: 0,
    away_score: 2,
    stage_name: 'Group E',
    venue: "Levi's Stadium, SF",
  },
  {
    id: 'ext-6',
    home_team: { name: 'Japan', flag: '🇯🇵' },
    away_team: { name: 'South Korea', flag: '🇰🇷' },
    local_date: new Date(Date.now() + 10 * 3600 * 1000).toISOString(),
    status: 'scheduled',
    stage_name: 'Group F',
    venue: 'Arrowhead Stadium, KC',
  },
  {
    id: 'ext-7',
    home_team: { name: 'Netherlands', flag: '🇳🇱' },
    away_team: { name: 'Senegal', flag: '🇸🇳' },
    local_date: new Date(Date.now() + 14 * 3600 * 1000).toISOString(),
    status: 'scheduled',
    stage_name: 'Group G',
    venue: 'Lincoln Financial Field, Philly',
  },
  {
    id: 'ext-8',
    home_team: { name: 'Canada', flag: '🇨🇦' },
    away_team: { name: 'Morocco', flag: '🇲🇦' },
    local_date: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    status: 'completed',
    home_score: 1,
    away_score: 2,
    stage_name: 'Group H',
    venue: 'BC Place, Vancouver',
  },
];

// ─── Normalisation helpers ──────────────────────────────────────────────────

const TEAM_FLAGS: Record<string, string> = {
  'USA': '🇺🇸', 'United States': '🇺🇸',
  'Mexico': '🇲🇽', 'MEX': '🇲🇽',
  'Canada': '🇨🇦', 'CAN': '🇨🇦',
  'Brazil': '🇧🇷', 'BRA': '🇧🇷',
  'Argentina': '🇦🇷', 'ARG': '🇦🇷',
  'France': '🇫🇷', 'FRA': '🇫🇷',
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Germany': '🇩🇪', 'GER': '🇩🇪',
  'Spain': '🇪🇸', 'ESP': '🇪🇸',
  'Portugal': '🇵🇹', 'POR': '🇵🇹',
  'Belgium': '🇧🇪', 'BEL': '🇧🇪',
  'Japan': '🇯🇵', 'JPN': '🇯🇵',
  'South Korea': '🇰🇷', 'KOR': '🇰🇷',
  'Netherlands': '🇳🇱', 'NED': '🇳🇱',
  'Senegal': '🇸🇳', 'SEN': '🇸🇳',
  'Morocco': '🇲🇦', 'MAR': '🇲🇦', 'MOR': '🇲🇦',
  'South Africa': '🇿🇦',
  'Czech Republic': '🇨🇿',
};

const parseScore = (score: string | number | null | undefined): number | null => {
  if (score === null || score === undefined || score === 'null' || score === '') return null;
  const num = Number(score);
  return isNaN(num) ? null : num;
};

/**
 * Normalise the external API's status string to our internal enum.
 */
const normaliseStatus = (match: WC26ApiMatch): string => {
  if (match.time_elapsed) {
    const elapsed = match.time_elapsed.toLowerCase();
    if (elapsed === 'finished' || match.finished === 'TRUE') return 'FINISHED';
    if (elapsed === 'live' || elapsed.includes('min')) return 'LIVE';
    return 'PENDING';
  }
  const apiStatus = match.status;
  if (!apiStatus) return 'PENDING';
  const s = apiStatus.toLowerCase();
  if (s.includes('live') || s.includes('progress') || s.includes('in_play')) return 'LIVE';
  if (s.includes('finished') || s.includes('completed') || s.includes('ft') || s.includes('full')) return 'FINISHED';
  return 'PENDING';
};

/**
 * Extract the team name safely from either API shape.
 */
const getTeamName = (match: WC26ApiMatch, side: 'home' | 'away'): string => {
  if (side === 'home') {
    if (match.home_team_name_en) return match.home_team_name_en;
    const t = match.home_team ?? match.home;
    return t?.name ?? (t as any)?.name_code ?? (t as any)?.code ?? 'TBD';
  } else {
    if (match.away_team_name_en) return match.away_team_name_en;
    const t = match.away_team ?? match.away;
    return t?.name ?? (t as any)?.name_code ?? (t as any)?.code ?? 'TBD';
  }
};

/**
 * Extract team flag URL/emoji safely.
 */
const getTeamFlag = (match: WC26ApiMatch, side: 'home' | 'away'): string | null => {
  const name = getTeamName(match, side);
  if (TEAM_FLAGS[name]) return TEAM_FLAGS[name];

  const t = side === 'home'
    ? (match.home_team ?? match.home)
    : (match.away_team ?? match.away);
  return t?.flag ?? null;
};

const STADIUM_OFFSETS: Record<string, number> = {
  '1': -6,  // Mexico City (Standard time all year round, CST)
  '2': -6,  // Guadalajara (CST)
  '3': -6,  // Monterrey (CST)
  '4': -5,  // Dallas (CDT, Central Daylight Time)
  '5': -5,  // Houston (CDT)
  '6': -5,  // Kansas City (CDT)
  '7': -4,  // Atlanta (EDT, Eastern Daylight Time)
  '8': -4,  // Miami (EDT)
  '9': -4,  // Boston (EDT)
  '10': -4, // Philadelphia (EDT)
  '11': -4, // New York/New Jersey (EDT)
  '12': -4, // Toronto (EDT)
  '13': -7, // Vancouver (PDT, Pacific Daylight Time)
  '14': -7, // Seattle (PDT)
  '15': -7, // San Francisco (PDT)
  '16': -7, // Los Angeles (PDT)
};

/**
 * Parse match datetime from API fields — handles ISO strings and date+time combos.
 */
const parseMatchTime = (match: WC26ApiMatch): Date => {
  const stadiumId = (match as any).stadium_id;
  const offset = STADIUM_OFFSETS[String(stadiumId)] ?? -5; // Default to -5 (average US offset)

  if (match.local_date) {
    const d = new Date(match.local_date);
    if (!isNaN(d.getTime()) && match.local_date.includes('T')) return d;

    // Fallback parsing for MM/DD/YYYY HH:MM
    const parts = match.local_date.split(' ');
    if (parts.length === 2) {
      const dateParts = parts[0].split('/');
      const timeParts = parts[1].split(':');
      if (dateParts.length === 3 && timeParts.length >= 2) {
        const month = parseInt(dateParts[0], 10) - 1;
        const day = parseInt(dateParts[1], 10);
        const year = parseInt(dateParts[2], 10);
        const hour = parseInt(timeParts[0], 10);
        const min = parseInt(timeParts[1], 10);
        
        // Convert local time in stadium's time zone to UTC
        // UTC = LocalTime - offset (e.g. 15:00 at UTC-5 -> 15 - (-5) = 20:00 UTC)
        const utcTime = Date.UTC(year, month, day, hour, min) - offset * 60 * 60 * 1000;
        const d2 = new Date(utcTime);
        if (!isNaN(d2.getTime())) return d2;
      }
    }
  }
  if (match.date) {
    const combined = match.time ? `${match.date}T${match.time}` : match.date;
    const d = new Date(combined);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date('2099-01-01T00:00:00Z');
};

/**
 * Extract stage name from API, collapsing various formats.
 */
const getStage = (match: WC26ApiMatch): string => {
  if (match.type && match.type !== 'group') {
    return match.type.charAt(0).toUpperCase() + match.type.slice(1) + ' Stage';
  }
  if (match.group) {
    return `Group ${match.group}`;
  }
  return match.stage_name ?? 'Group Stage';
};

// ─── Core sync logic ────────────────────────────────────────────────────────

/**
 * Perform a single sync cycle:
 *   - Fetch all matches from worldcup26.ir
 *   - Upsert into local database
 *   - Trigger points engine for newly finished matches
 *
 * @returns Number of matches synced
 */
export const syncMatches = async (): Promise<number> => {
  let apiMatches: WC26ApiMatch[] = [];

  try {
    // Try the most likely endpoint paths (API may expose different routes)
    const endpoints = [
      `${env.WC_API_BASE_URL}/get/games`,
      `${env.WC_API_BASE_URL}/matches`,
      `${env.WC_API_BASE_URL}/api/get/games`,
      `${env.WC_API_BASE_URL}/v1/matches`,
      `${env.WC_API_BASE_URL}/games`,
    ];

    let fetchSuccess = false;
    for (const url of endpoints) {
      try {
        const response = await axios.get<WC26ApiResponse | WC26ApiMatch[]>(url, {
          timeout: 10000,
          headers: { 'Accept': 'application/json' },
        });

        // Handle both array and object responses
        const data = response.data;
        if (Array.isArray(data)) {
          apiMatches = data;
        } else {
          apiMatches = (data as any).games ?? data.matches ?? data.data ?? data.results ?? [];
        }

        if (apiMatches.length > 0) {
          fetchSuccess = true;
          break;
        }
      } catch {
        // Try next endpoint
        continue;
      }
    }

    if (!fetchSuccess) {
      console.warn('⚠️  SyncService: Could not fetch matches from any endpoint. Skipping sync.');
      return 0;
    }
  } catch (err) {
    const axiosErr = err as AxiosError;
    console.error(`❌ SyncService: API fetch failed — ${axiosErr.message}. Skipping sync.`);
    return 0;
  }

  console.log(`🔄 SyncService: Fetched ${apiMatches.length} matches from worldcup26.ir`);

  let syncedCount = 0;
  const newlyFinished: Array<{ id: string; scoreA: number; scoreB: number }> = [];

  for (const apiMatch of apiMatches) {
    const externalId = String(apiMatch.id);
    const newStatus = normaliseStatus(apiMatch);
    const scoreA = parseScore(apiMatch.home_score);
    const scoreB = parseScore(apiMatch.away_score);

    // Check the previous status to detect transitions to FINISHED
    const existing: Match | null = await matchRepo.findMatchByExternalId(externalId);
    const wasFinished = existing?.status === 'FINISHED';

    // Upsert the match record
    const upserted = await matchRepo.upsertMatch({
      externalId,
      teamA: getTeamName(apiMatch, 'home'),
      teamB: getTeamName(apiMatch, 'away'),
      teamAFlag: getTeamFlag(apiMatch, 'home'),
      teamBFlag: getTeamFlag(apiMatch, 'away'),
      matchTime: parseMatchTime(apiMatch),
      status: newStatus,
      scoreA,
      scoreB,
      stage: getStage(apiMatch),
      venue: apiMatch.venue ?? apiMatch.stadium?.name ?? null,
    });

    syncedCount++;

    // Detect fresh FINISHED transitions to trigger the points engine
    if (newStatus === 'FINISHED' && !wasFinished) {
      if (scoreA !== null && scoreA !== undefined &&
          scoreB !== null && scoreB !== undefined) {
        newlyFinished.push({ id: upserted.id, scoreA, scoreB });
      }
    }
  }

  // Fire points engine for each newly finished match
  for (const match of newlyFinished) {
    console.log(`⚽ SyncService: Match ${match.id} just finished. Calculating points...`);
    await calculatePoints(match.id, match.scoreA, match.scoreB);
  }

  return syncedCount;
};

// ─── Adaptive scheduler ─────────────────────────────────────────────────────

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedule the next sync cycle.
 * Uses a faster interval when live matches are running,
 * and a relaxed interval otherwise (saves API quota).
 */
const scheduleNextSync = async (): Promise<void> => {
  const liveMatches = await matchRepo.findLiveMatches();
  const interval = liveMatches.length > 0
    ? env.SYNC_INTERVAL_LIVE   // 2 min during live matches
    : env.SYNC_INTERVAL_IDLE;  // 10 min otherwise

  syncTimer = setTimeout(async () => {
    await runSyncCycle();
  }, interval);
};

/**
 * Run one full sync cycle and schedule the next one.
 */
const runSyncCycle = async (): Promise<void> => {
  try {
    const count = await syncMatches();
    console.log(`✅ SyncService: Cycle complete. ${count} matches synced.`);
  } catch (err) {
    console.error('❌ SyncService: Unexpected error during sync cycle:', err);
  } finally {
    await scheduleNextSync();
  }
};

/**
 * Start the SyncService.
 * Runs an initial sync immediately on startup, then schedules
 * subsequent syncs adaptively based on live match status.
 */
export const startSyncService = async (): Promise<void> => {
  console.log('🚀 SyncService: Starting...');
  await runSyncCycle();
};

/**
 * Stop the SyncService (useful for graceful shutdown or testing).
 */
export const stopSyncService = (): void => {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
    console.log('🛑 SyncService: Stopped.');
  }
};
