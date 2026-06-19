import axios from 'axios';
import fs from 'fs';
import path from 'path';

const TEAM_NAME_MAPPINGS: Record<string, string> = {
  'Korea Republic': 'South Korea',
  'Czechia': 'Czech Republic',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
  'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
  'Côte d\'Ivoire': 'Ivory Coast',
  'Cote d\'Ivoire': 'Ivory Coast',
  'DR Congo': 'Congo DR',
  'IR Iran': 'Iran',
  'China PR': 'China'
};

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

// Simple helper to get team flag from name
function getFlag(teamName: string): string | null {
  if (TEAM_FLAGS[teamName]) return TEAM_FLAGS[teamName];
  // Dynamic lookup or default to null
  return null;
}

function getStageName(stage: string, group?: string): string {
  if (stage === 'group-stage') {
    return group ? `Group ${group}` : 'Group Stage';
  }
  if (stage === 'round-of-32') return 'Round of 32';
  if (stage === 'round-of-16') return 'Round of 16';
  if (stage === 'quarter-finals') return 'Quarter-finals';
  if (stage === 'semi-finals') return 'Semi-finals';
  if (stage === 'third-place-play-off') return 'Third-place Match';
  if (stage === 'final') return 'Final';
  return stage;
}

async function run() {
  const url = 'https://www.thestatsapi.com/world-cup/data/fixtures.json';
  console.log(`Downloading fixtures from ${url}...`);
  try {
    const res = await axios.get(url);
    const fixtures = res.data.fixtures;
    console.log(`Successfully fetched ${fixtures.length} fixtures.`);

    const mappedMatches = fixtures.map((f: any) => {
      let homeTeam = f.homeTeam;
      let awayTeam = f.awayTeam;

      // Apply name mappings
      if (TEAM_NAME_MAPPINGS[homeTeam]) homeTeam = TEAM_NAME_MAPPINGS[homeTeam];
      if (TEAM_NAME_MAPPINGS[awayTeam]) awayTeam = TEAM_NAME_MAPPINGS[awayTeam];

      return {
        externalId: String(f.matchNumber),
        teamA: homeTeam,
        teamB: awayTeam,
        teamAFlag: getFlag(homeTeam),
        teamBFlag: getFlag(awayTeam),
        matchTime: f.kickoffUtc,
        status: 'PENDING',
        scoreA: null,
        scoreB: null,
        stage: getStageName(f.stage, f.group),
        venue: f.stadium || null
      };
    });

    const outputPath = path.join(__dirname, '../src/config/initialMatches.json');
    // Ensure parent dir exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(mappedMatches, null, 2), 'utf-8');
    console.log(`Successfully wrote ${mappedMatches.length} mapped matches to ${outputPath}`);
  } catch (err: any) {
    console.error('Failed to build seed file:', err.message);
  }
}

run();
