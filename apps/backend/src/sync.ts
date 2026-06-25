import { query } from './db';

/**
 * Utility to parse local_date string in format "MM/DD/YYYY HH:MM" to UTC Date object.
 */
function parseLocalDate(localDateStr: string): Date {
  const [datePart, timePart] = localDateStr.split(' ');
  const [month, day, year] = datePart.split('/').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

/**
 * Grades user predictions for a newly completed match.
 */
async function gradePredictionsForMatch(matchId: string, homeScore: number, awayScore: number) {
  try {
    await query('BEGIN');
    
    // Fetch unprocessed predictions
    const predsRes = await query(
      'SELECT * FROM predictions WHERE match_id = $1 AND is_processed = false',
      [matchId]
    );

    for (const pred of predsRes.rows) {
      const isCorrect = pred.predicted_home_score === homeScore && pred.predicted_away_score === awayScore;
      if (isCorrect) {
        await query(
          'UPDATE users SET total_points = total_points + 1 WHERE id = $1',
          [pred.user_id]
        );
      }
      await query(
        'UPDATE predictions SET is_processed = true WHERE id = $1',
        [pred.id]
      );
    }
    
    await query('COMMIT');
    console.log(`[Sync] Graded ${predsRes.rows.length} predictions for match ${matchId}. Actual Score: ${homeScore}-${awayScore}`);
  } catch (err) {
    await query('ROLLBACK');
    console.error(`[Sync] Error grading predictions for match ${matchId}:`, err);
  }
}

/**
 * Sync matches from the worldcup26.ir API
 */
export async function syncWorldCupMatches() {
  console.log('[Sync] Starting World Cup 2026 matches synchronization...');
  try {
    const response = await fetch('https://worldcup26.ir/get/games');
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const games = data.games || [];
    console.log(`[Sync] Successfully fetched ${games.length} matches from worldcup26.ir`);

    let insertedCount = 0;
    let updatedCount = 0;

    for (const game of games) {
      const matchId = game.id;
      const eventId = 'wc2026';
      
      // Map team names, fallback to label for knockout stage placeholders
      const homeTeam = game.home_team_name_en || game.home_team_label || 'TBD';
      const awayTeam = game.away_team_name_en || game.away_team_label || 'TBD';

      // Parse kickoff time
      let kickoffTime: Date;
      if (game.local_date) {
        kickoffTime = parseLocalDate(game.local_date);
      } else {
        kickoffTime = new Date();
      }

      // Map status
      let status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' = 'SCHEDULED';
      if (game.finished === 'TRUE' || game.time_elapsed === 'finished') {
        status = 'COMPLETED';
      } else if (game.time_elapsed && game.time_elapsed !== 'notstarted') {
        status = 'LIVE';
      }

      // Parse scores (keep null if scheduled to avoid showing fake 0-0 lines)
      let homeScore: number | null = null;
      let awayScore: number | null = null;
      if (status !== 'SCHEDULED') {
        homeScore = game.home_score !== null && game.home_score !== undefined ? parseInt(game.home_score, 10) : 0;
        awayScore = game.away_score !== null && game.away_score !== undefined ? parseInt(game.away_score, 10) : 0;
      }

      // Query if match already exists
      const existingMatchRes = await query('SELECT * FROM matches WHERE id = $1', [matchId]);

      if (existingMatchRes.rows.length === 0) {
        // Insert new match record
        await query(
          `INSERT INTO matches (id, event_id, home_team, away_team, kickoff_time, home_score, away_score, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [matchId, eventId, homeTeam, awayTeam, kickoffTime.toISOString(), homeScore, awayScore, status]
        );
        insertedCount++;

        // Grade predictions if it's already completed when syncing for the first time
        if (status === 'COMPLETED') {
          await gradePredictionsForMatch(matchId, homeScore!, awayScore!);
        }
      } else {
        const existingMatch = existingMatchRes.rows[0];
        const oldStatus = existingMatch.status;

        // Update existing match record
        await query(
          `UPDATE matches 
           SET home_team = $1, away_team = $2, kickoff_time = $3, home_score = $4, away_score = $5, status = $6
           WHERE id = $7`,
          [homeTeam, awayTeam, kickoffTime.toISOString(), homeScore, awayScore, status, matchId]
        );
        updatedCount++;

        // Trigger prediction resolution if the match has just completed
        if (status === 'COMPLETED' && oldStatus !== 'COMPLETED') {
          await gradePredictionsForMatch(matchId, homeScore!, awayScore!);
        }
      }
    }

    console.log(`[Sync] Sync finished successfully. Inserted: ${insertedCount}, Updated: ${updatedCount}`);
    return { success: true, insertedCount, updatedCount };
  } catch (error) {
    console.error('[Sync] Error syncing World Cup matches:', error);
    throw error;
  }
}
