import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/fantasy_football';

console.log(`Connecting to database: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

// Flag to determine if we should fall back to mock storage
let useMock = false;

// Mock DB State
let mockUsers: Array<{ id: string; username: string; password_hash: string; total_points: number }> = [];
let mockMatches: Array<{
  id: string;
  event_id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
}> = [];
let mockPredictions: Array<{
  id: string;
  user_id: string;
  match_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
  is_processed: boolean;
}> = [];

// Seed function for mock data
function seedMockMatches() {
  const now = new Date();
  
  const addHours = (date: Date, hours: number) => {
    const d = new Date(date);
    d.setHours(d.getHours() + hours);
    return d;
  };

  const addMinutes = (date: Date, minutes: number) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() + minutes);
    return d;
  };

  mockMatches = [
    {
      id: 'match_1',
      event_id: 'wc2026',
      home_team: 'USA',
      away_team: 'England',
      kickoff_time: addHours(now, 2).toISOString(),
      home_score: null,
      away_score: null,
      status: 'SCHEDULED'
    },
    {
      id: 'match_2',
      event_id: 'wc2026',
      home_team: 'Argentina',
      away_team: 'France',
      kickoff_time: addHours(now, 5).toISOString(),
      home_score: null,
      away_score: null,
      status: 'SCHEDULED'
    },
    {
      id: 'match_3',
      event_id: 'wc2026',
      home_team: 'Brazil',
      away_team: 'Germany',
      kickoff_time: addHours(now, -3).toISOString(),
      home_score: 2,
      away_score: 1,
      status: 'COMPLETED'
    },
    {
      id: 'match_4',
      event_id: 'wc2026',
      home_team: 'Spain',
      away_team: 'Italy',
      kickoff_time: addMinutes(now, 15).toISOString(),
      home_score: null,
      away_score: null,
      status: 'SCHEDULED'
    },
    {
      id: 'match_5',
      event_id: 'wc2026',
      home_team: 'Mexico',
      away_team: 'Canada',
      kickoff_time: addHours(now, 24).toISOString(),
      home_score: null,
      away_score: null,
      status: 'SCHEDULED'
    }
  ];
}

// Global SQL query router
export async function query(text: string, params?: any[]): Promise<{ rows: any[] }> {
  if (useMock) {
    return handleMockQuery(text, params || []);
  }

  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error('PostgreSQL query error, testing in-memory fallback conditions...', err);
    throw err;
  }
}

// Mock query processor executing operations in memory
async function handleMockQuery(text: string, params: any[]): Promise<{ rows: any[] }> {
  const normalizedSql = text.replace(/\s+/g, ' ').trim();

  // 1. SELECT id FROM users WHERE username = $1
  if (normalizedSql.startsWith('SELECT id FROM users WHERE username =')) {
    const username = params[0];
    const match = mockUsers.find(u => u.username === username);
    return { rows: match ? [{ id: match.id }] : [] };
  }

  // 2. INSERT INTO users
  if (normalizedSql.startsWith('INSERT INTO users')) {
    const username = params[0];
    const passwordHash = params[1];
    const newUser = {
      id: crypto.randomUUID(),
      username,
      password_hash: passwordHash,
      total_points: 0
    };
    mockUsers.push(newUser);
    return { rows: [newUser] };
  }

  // 3. SELECT id, username, password_hash, total_points FROM users WHERE username = $1
  if (normalizedSql.startsWith('SELECT id, username, password_hash, total_points FROM users WHERE username =')) {
    const username = params[0];
    const match = mockUsers.find(u => u.username === username);
    return { rows: match ? [match] : [] };
  }

  // 4. SELECT id, username, total_points FROM users WHERE id = $1
  if (normalizedSql.startsWith('SELECT id, username, total_points FROM users WHERE id =')) {
    const userId = params[0];
    const match = mockUsers.find(u => u.id === userId);
    return { rows: match ? [match] : [] };
  }

  // 5. SELECT * FROM matches WHERE event_id = $1
  if (normalizedSql.startsWith('SELECT * FROM matches WHERE event_id =')) {
    const eventId = params[0];
    const results = mockMatches.filter(m => m.event_id === eventId);
    return { rows: results };
  }

  // 6. SELECT * FROM matches ORDER BY kickoff_time
  if (normalizedSql.startsWith('SELECT * FROM matches ORDER BY')) {
    return { rows: [...mockMatches].sort((a, b) => a.kickoff_time.localeCompare(b.kickoff_time)) };
  }

  // 7. SELECT kickoff_time, status FROM matches WHERE id = $1
  if (normalizedSql.startsWith('SELECT kickoff_time, status FROM matches WHERE id =')) {
    const matchId = params[0];
    const m = mockMatches.find(x => x.id === matchId);
    return { rows: m ? [{ kickoff_time: m.kickoff_time, status: m.status }] : [] };
  }

  // 8. SELECT * FROM matches WHERE id = $1
  if (normalizedSql.startsWith('SELECT * FROM matches WHERE id =')) {
    const matchId = params[0];
    const m = mockMatches.find(x => x.id === matchId);
    return { rows: m ? [m] : [] };
  }

  // 9. Submit prediction (upsert)
  if (normalizedSql.includes('INSERT INTO predictions') && normalizedSql.includes('ON CONFLICT')) {
    const userId = params[0];
    const matchId = params[1];
    const homeScore = params[2];
    const awayScore = params[3];

    const idx = mockPredictions.findIndex(p => p.user_id === userId && p.match_id === matchId);
    if (idx >= 0) {
      mockPredictions[idx].predicted_home_score = homeScore;
      mockPredictions[idx].predicted_away_score = awayScore;
      mockPredictions[idx].is_processed = false;
    } else {
      mockPredictions.push({
        id: crypto.randomUUID(),
        user_id: userId,
        match_id: matchId,
        predicted_home_score: homeScore,
        predicted_away_score: awayScore,
        is_processed: false
      });
    }
    return { rows: [] };
  }

  // 10. GET my predictions
  if (normalizedSql.startsWith('SELECT match_id, predicted_home_score, predicted_away_score, is_processed FROM predictions WHERE user_id =')) {
    const userId = params[0];
    const results = mockPredictions.filter(p => p.user_id === userId);
    return { rows: results };
  }

  // 11. GET leaderboard
  if (normalizedSql.startsWith('SELECT username, total_points FROM users ORDER BY total_points DESC')) {
    // Index emulation: Sort by total_points DESC, then by username ASC
    const sorted = [...mockUsers].sort((a, b) => {
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }
      return a.username.localeCompare(b.username);
    });
    return { rows: sorted.map(u => ({ username: u.username, total_points: u.total_points })) };
  }

  // 12. Simulate kickoff
  if (normalizedSql.startsWith('UPDATE matches SET kickoff_time = $1, status = \'LIVE\' WHERE id =')) {
    const kickoffTime = params[0];
    const matchId = params[1];
    const idx = mockMatches.findIndex(m => m.id === matchId);
    if (idx >= 0) {
      mockMatches[idx].kickoff_time = kickoffTime;
      mockMatches[idx].status = 'LIVE';
      return { rows: [mockMatches[idx]] };
    }
    return { rows: [] };
  }

  // 13. Resolve match
  if (normalizedSql.startsWith('UPDATE matches SET home_score = $1, away_score = $2, status = \'COMPLETED\' WHERE id =')) {
    const homeScore = params[0];
    const awayScore = params[1];
    const matchId = params[2];
    const idx = mockMatches.findIndex(m => m.id === matchId);
    if (idx >= 0) {
      mockMatches[idx].home_score = homeScore;
      mockMatches[idx].away_score = awayScore;
      mockMatches[idx].status = 'COMPLETED';
    }
    return { rows: [] };
  }

  // 13a. Mock insert match
  if (normalizedSql.startsWith('INSERT INTO matches')) {
    const [id, event_id, home_team, away_team, kickoff_time, home_score, away_score, status] = params;
    mockMatches.push({
      id,
      event_id,
      home_team,
      away_team,
      kickoff_time,
      home_score: home_score !== undefined ? home_score : null,
      away_score: away_score !== undefined ? away_score : null,
      status: status || 'SCHEDULED'
    });
    return { rows: [] };
  }

  // 13b. Mock update match full
  if (normalizedSql.startsWith('UPDATE matches SET home_team =')) {
    const [home_team, away_team, kickoff_time, home_score, away_score, status, id] = params;
    const idx = mockMatches.findIndex(m => m.id === id);
    if (idx >= 0) {
      mockMatches[idx].home_team = home_team;
      mockMatches[idx].away_team = away_team;
      mockMatches[idx].kickoff_time = kickoff_time;
      mockMatches[idx].home_score = home_score !== undefined ? home_score : null;
      mockMatches[idx].away_score = away_score !== undefined ? away_score : null;
      mockMatches[idx].status = status;
    }
    return { rows: [] };
  }

  // 14. Unprocessed predictions
  if (normalizedSql.startsWith('SELECT * FROM predictions WHERE match_id = $1 AND is_processed = false')) {
    const matchId = params[0];
    const results = mockPredictions.filter(p => p.match_id === matchId && !p.is_processed);
    return { rows: results };
  }

  // 15. Increment points
  if (normalizedSql.startsWith('UPDATE users SET total_points = total_points + 1 WHERE id =')) {
    const userId = params[0];
    const idx = mockUsers.findIndex(u => u.id === userId);
    if (idx >= 0) {
      mockUsers[idx].total_points += 1;
    }
    return { rows: [] };
  }

  // 16. Mark prediction as processed
  if (normalizedSql.startsWith('UPDATE predictions SET is_processed = true WHERE id =')) {
    const id = params[0];
    const idx = mockPredictions.findIndex(p => p.id === id);
    if (idx >= 0) {
      mockPredictions[idx].is_processed = true;
    }
    return { rows: [] };
  }

  // 17. Reset actions
  if (normalizedSql.startsWith('DELETE FROM predictions')) {
    mockPredictions = [];
    return { rows: [] };
  }
  if (normalizedSql.startsWith('DELETE FROM matches')) {
    mockMatches = [];
    return { rows: [] };
  }
  if (normalizedSql.startsWith('UPDATE users SET total_points = 0')) {
    mockUsers.forEach(u => u.total_points = 0);
    return { rows: [] };
  }

  // Simulation start transaction
  if (normalizedSql === 'BEGIN' || normalizedSql === 'COMMIT' || normalizedSql === 'ROLLBACK') {
    return { rows: [] };
  }

  console.warn(`[Mock DB] Query not implemented: "${normalizedSql}"`);
  return { rows: [] };
}

export async function initDb() {
  try {
    console.log('Testing connection to PostgreSQL...');
    // Quick validation check
    const client = await pool.connect();
    client.release();
    
    // Connect successful, create schemas
    useMock = false;
    const conn = await pool.connect();
    try {
      console.log('Initializing database schema in Postgres...');
      await conn.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          username VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          total_points INT DEFAULT 0 NOT NULL
        );
      `);
      await conn.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);
      `);
      await conn.query(`
        CREATE INDEX IF NOT EXISTS idx_users_total_points_desc ON users (total_points DESC);
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS matches (
          id VARCHAR(255) PRIMARY KEY,
          event_id VARCHAR(255) NOT NULL,
          home_team VARCHAR(255) NOT NULL,
          away_team VARCHAR(255) NOT NULL,
          kickoff_time TIMESTAMP WITH TIME ZONE NOT NULL,
          home_score INT,
          away_score INT,
          status VARCHAR(50) DEFAULT 'SCHEDULED' NOT NULL
        );
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS predictions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          match_id VARCHAR(255) NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
          predicted_outcome VARCHAR(50),
          predicted_home_score INT,
          predicted_away_score INT,
          is_processed BOOLEAN DEFAULT false NOT NULL,
          CONSTRAINT unique_user_match UNIQUE (user_id, match_id)
        );
      `);

      // Database migration logic for existing tables
      await conn.query(`
        ALTER TABLE predictions ADD COLUMN IF NOT EXISTS predicted_home_score INT;
      `);
      await conn.query(`
        ALTER TABLE predictions ADD COLUMN IF NOT EXISTS predicted_away_score INT;
      `);
      await conn.query(`
        ALTER TABLE predictions ALTER COLUMN predicted_outcome DROP NOT NULL;
      `);
      await conn.query(`
        CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions (user_id);
      `);
      await conn.query(`
        CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON predictions (match_id);
      `);

      // Try to sync World Cup 2026 fixtures from the API dynamically on startup
      try {
        console.log('Attempting to sync World Cup 2026 matches from worldcup26.ir API...');
        const { syncWorldCupMatches } = await import('./sync');
        await syncWorldCupMatches();
        console.log('Successfully synced real World Cup 2026 matches from API.');
      } catch (syncErr) {
        console.warn('Failed to sync matches from API on startup, seeding fallback mock matches data...', syncErr);
        
        // Seed mock matches as fallback
        const now = new Date();
        const addHours = (d: Date, h: number) => { const x = new Date(d); x.setHours(x.getHours() + h); return x; };
        const addMinutes = (d: Date, m: number) => { const x = new Date(d); x.setMinutes(x.getMinutes() + m); return x; };

        const mockMatchesData = [
          { id: 'match_1', event_id: 'wc2026', home_team: 'USA', away_team: 'England', kickoff_time: addHours(now, 2).toISOString(), home_score: null, away_score: null, status: 'SCHEDULED' },
          { id: 'match_2', event_id: 'wc2026', home_team: 'Argentina', away_team: 'France', kickoff_time: addHours(now, 5).toISOString(), home_score: null, away_score: null, status: 'SCHEDULED' },
          { id: 'match_3', event_id: 'wc2026', home_team: 'Brazil', away_team: 'Germany', kickoff_time: addHours(now, -3).toISOString(), home_score: 2, away_score: 1, status: 'COMPLETED' },
          { id: 'match_4', event_id: 'wc2026', home_team: 'Spain', away_team: 'Italy', kickoff_time: addMinutes(now, 15).toISOString(), home_score: null, away_score: null, status: 'SCHEDULED' },
          { id: 'match_5', event_id: 'wc2026', home_team: 'Mexico', away_team: 'Canada', kickoff_time: addHours(now, 24).toISOString(), home_score: null, away_score: null, status: 'SCHEDULED' }
        ];

        for (const m of mockMatchesData) {
          await conn.query(`
            INSERT INTO matches (id, event_id, home_team, away_team, kickoff_time, home_score, away_score, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO NOTHING;
          `, [m.id, m.event_id, m.home_team, m.away_team, m.kickoff_time, m.home_score, m.away_score, m.status]);
        }
      }
      console.log('Postgres database successfully initialized.');
    } finally {
      conn.release();
    }
  } catch (err) {
    console.warn('\n========================================================================');
    console.warn('[DATABASE CONNECTION FAILED] Could not connect to PostgreSQL server.');
    console.warn('Falling back to IN-MEMORY DATABASE sandbox for local testing.');
    console.warn('Authentication, predictions, and scoring will run entirely in memory!');
    console.warn('========================================================================\n');
    useMock = true;
    seedMockMatches();
  }
}
