import { FastifyInstance } from 'fastify';
import { query } from '../db';

export async function simulationRoutes(fastify: FastifyInstance) {
  
  // 1. Force a kickoff immediately (test lockout behavior)
  fastify.post('/kickoff', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const { matchId } = request.body as { matchId: string };
    if (!matchId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'matchId is required' });
    }

    try {
      const fiveMinutesAgo = new Date();
      fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

      const res = await query(
        'UPDATE matches SET kickoff_time = $1, status = \'LIVE\' WHERE id = $2 RETURNING *',
        [fiveMinutesAgo.toISOString(), matchId]
      );

      if (res.rows.length === 0) {
        return reply.status(404).send({ error: 'Not Found', message: 'Match not found' });
      }

      return reply.send({
        success: true,
        message: 'Match kickoff simulated successfully. Match is now locked.',
        match: res.rows[0]
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to simulate kickoff' });
    }
  });

  // 2. Resolve a match (test scoring engine)
  fastify.post('/resolve', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const { matchId, homeScore, awayScore } = request.body as { matchId: string; homeScore: number; awayScore: number };
    
    if (!matchId || homeScore === undefined || awayScore === undefined) {
      return reply.status(400).send({ error: 'Bad Request', message: 'matchId, homeScore, and awayScore are required' });
    }

    try {
      // Fetch the match
      const matchRes = await query('SELECT * FROM matches WHERE id = $1', [matchId]);
      if (matchRes.rows.length === 0) {
        return reply.status(404).send({ error: 'Not Found', message: 'Match not found' });
      }

      const match = matchRes.rows[0];

      // Determine actual outcome
      let actualOutcome: 'HOME_WIN' | 'AWAY_WIN' | 'DRAW';
      if (homeScore > awayScore) {
        actualOutcome = 'HOME_WIN';
      } else if (awayScore > homeScore) {
        actualOutcome = 'AWAY_WIN';
      } else {
        actualOutcome = 'DRAW';
      }

      // Start transaction to execute scoring atomically
      await query('BEGIN');

      // 1. Update Match record
      await query(
        'UPDATE matches SET home_score = $1, away_score = $2, status = \'COMPLETED\' WHERE id = $3',
        [homeScore, awayScore, matchId]
      );

      // 2. Fetch unprocessed predictions for this match
      const predsRes = await query(
        'SELECT * FROM predictions WHERE match_id = $1 AND is_processed = false',
        [matchId]
      );

      let correctPredictionsCount = 0;

      // 3. Score each prediction
      for (const pred of predsRes.rows) {
        const isCorrect = pred.predicted_outcome === actualOutcome;
        
        if (isCorrect) {
          await query(
            'UPDATE users SET total_points = total_points + 1 WHERE id = $1',
            [pred.user_id]
          );
          correctPredictionsCount++;
        }

        // Mark prediction as processed
        await query(
          'UPDATE predictions SET is_processed = true WHERE id = $1',
          [pred.id]
        );
      }

      await query('COMMIT');

      return reply.send({
        success: true,
        message: 'Match resolved and scored successfully.',
        actualOutcome,
        totalPredictionsProcessed: predsRes.rows.length,
        correctPredictions: correctPredictionsCount
      });
    } catch (err) {
      await query('ROLLBACK');
      request.log.error(err);
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Scoring engine failure' });
    }
  });

  // 3. Reset all simulation data (re-seeds matches, resets scores/predictions)
  fastify.post('/reset', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    try {
      await query('BEGIN');
      
      // Clear data
      await query('DELETE FROM predictions');
      await query('DELETE FROM matches');
      await query('UPDATE users SET total_points = 0');
      
      await query('COMMIT');

      // Re-initialize (reseed matches)
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

      const mockMatches = [
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

      for (const match of mockMatches) {
        await query(`
          INSERT INTO matches (id, event_id, home_team, away_team, kickoff_time, home_score, away_score, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [match.id, match.event_id, match.home_team, match.away_team, match.kickoff_time, match.home_score, match.away_score, match.status]);
      }

      return reply.send({
        success: true,
        message: 'Matches re-seeded, predictions deleted, and all points reset to 0.'
      });
    } catch (err) {
      await query('ROLLBACK');
      request.log.error(err);
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to reset simulation' });
    }
  });
}
