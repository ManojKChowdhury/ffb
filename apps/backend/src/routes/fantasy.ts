import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PredictionSubmissionSchema } from '@fantasy/shared';
import { query } from '../db';
import { syncWorldCupMatches } from '../sync';

export async function fantasyRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();

  // 1. Get matches list for a specific tournament event (e.g. wc2026)
  server.get('/matches', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    try {
      const { eventId } = request.query as { eventId?: string };
      
      let queryText = 'SELECT * FROM matches ORDER BY kickoff_time ASC';
      const params: any[] = [];
      
      if (eventId) {
        queryText = 'SELECT * FROM matches WHERE event_id = $1 ORDER BY kickoff_time ASC';
        params.push(eventId);
      }
      
      const res = await query(queryText, params);
      
      // Map rows and compute locked status dynamically based on current server time
      const matches = res.rows.map(match => {
        const kickoff = new Date(match.kickoff_time);
        const now = new Date();
        return {
          ...match,
          is_locked: now >= kickoff
        };
      });

      return reply.send({ success: true, matches });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to retrieve match listings' });
    }
  });

  // 2. Submit or update a prediction
  server.post('/predictions', {
    onRequest: [(fastify as any).authenticate],
    schema: {
      body: PredictionSubmissionSchema
    }
  }, async (request, reply) => {
    const userJwt = request.user as { id: string; username: string };
    const { matchId, predictedHomeScore, predictedAwayScore } = request.body as {
      matchId: string;
      predictedHomeScore: number;
      predictedAwayScore: number;
    };

    try {
      // Fetch match kickoff details to enforce lockout logic
      const matchRes = await query('SELECT kickoff_time, status FROM matches WHERE id = $1', [matchId]);
      if (matchRes.rows.length === 0) {
        return reply.status(404).send({ error: 'Not Found', message: 'Match not found' });
      }

      const match = matchRes.rows[0];
      const kickoff = new Date(match.kickoff_time);
      const now = new Date();

      // Lockout Logic: reject writes if match kickoff has passed or match is already live/completed
      if (now >= kickoff || match.status !== 'SCHEDULED') {
        return reply.status(400).send({
          error: 'Forbidden',
          message: 'Match has already kicked off. Predictions are locked!'
        });
      }

      // Upsert user prediction
      await query(`
        INSERT INTO predictions (user_id, match_id, predicted_home_score, predicted_away_score)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, match_id) 
        DO UPDATE SET 
          predicted_home_score = EXCLUDED.predicted_home_score,
          predicted_away_score = EXCLUDED.predicted_away_score,
          is_processed = false
      `, [userJwt.id, matchId, predictedHomeScore, predictedAwayScore]);

      return reply.send({
        success: true,
        message: 'Prediction submitted successfully'
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to save prediction' });
    }
  });

  // 3. Get predictions made by current logged-in user
  server.get('/predictions/my', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const userJwt = request.user as { id: string; username: string };

    try {
      const res = await query('SELECT match_id, predicted_home_score, predicted_away_score, is_processed FROM predictions WHERE user_id = $1', [userJwt.id]);
      return reply.send({ success: true, predictions: res.rows });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch predictions' });
    }
  });

  // 4. Get leaderboard sorted by total_points DESC
  server.get('/leaderboard', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    try {
      // Sorting order: descending total points, then alphabetical by username for tie breaking
      const res = await query('SELECT username, total_points FROM users ORDER BY total_points DESC, username ASC');
      return reply.send({ success: true, leaderboard: res.rows });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to query leaderboard' });
    }
  });

  // 5. Trigger manual score and match sync
  server.post('/sync-matches', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    try {
      const result = await syncWorldCupMatches();
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to synchronize matches from API' });
    }
  });
}
