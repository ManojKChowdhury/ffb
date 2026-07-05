import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { BetSubmissionSchema } from '@fantasy/shared';
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

  // 2. Submit or update a prediction with bet stake
  server.post('/predictions', {
    onRequest: [(fastify as any).authenticate],
    schema: {
      body: BetSubmissionSchema
    }
  }, async (request, reply) => {
    const userJwt = request.user as { id: string; username: string };
    const { matchId, predictedHomeScore, predictedAwayScore, betAmount } = request.body as {
      matchId: string;
      predictedHomeScore: number;
      predictedAwayScore: number;
      betAmount: number;
    };

    if (betAmount <= 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Bet amount must be greater than zero' });
    }

    try {
      // Start database transaction
      await query('BEGIN');

      // Fetch match kickoff details to enforce lockout logic
      const matchRes = await query('SELECT kickoff_time, status FROM matches WHERE id = $1', [matchId]);
      if (matchRes.rows.length === 0) {
        await query('ROLLBACK');
        return reply.status(404).send({ error: 'Not Found', message: 'Match not found' });
      }

      const match = matchRes.rows[0];
      const kickoff = new Date(match.kickoff_time);
      const now = new Date();

      // Lockout Logic: reject writes if match kickoff has passed or match is already live/completed
      if (now >= kickoff || match.status !== 'SCHEDULED') {
        await query('ROLLBACK');
        return reply.status(400).send({
          error: 'Forbidden',
          message: 'Match has already kicked off. Predictions are locked!'
        });
      }

      // Fetch user's current wallet balance
      const userRes = await query('SELECT wallet_balance FROM users WHERE id = $1', [userJwt.id]);
      if (userRes.rows.length === 0) {
        await query('ROLLBACK');
        return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
      }
      const walletBalance = userRes.rows[0].wallet_balance;

      // Fetch user's existing prediction for this match (if any)
      const existingPredRes = await query(
        'SELECT bet_amount FROM predictions WHERE user_id = $1 AND match_id = $2',
        [userJwt.id, matchId]
      );
      const oldBetAmount = existingPredRes.rows.length > 0 ? (existingPredRes.rows[0].bet_amount || 0) : 0;

      // Check if user has sufficient funds (accounting for refunding the old stake)
      const affordableBalance = walletBalance + oldBetAmount;
      if (betAmount > affordableBalance) {
        await query('ROLLBACK');
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Insufficient wallet balance. You need ${betAmount} tokens, but you only have ${affordableBalance} tokens (including refund from previous bet).`
        });
      }

      // Deduct net stake difference from user's wallet
      const netStakeDifference = betAmount - oldBetAmount;
      if (netStakeDifference !== 0) {
        if (netStakeDifference > 0) {
          await query('UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2', [netStakeDifference, userJwt.id]);
        } else {
          // Refund difference
          await query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [-netStakeDifference, userJwt.id]);
        }
      }

      // Upsert user prediction
      await query(`
        INSERT INTO predictions (user_id, match_id, predicted_home_score, predicted_away_score, bet_amount)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, match_id) 
        DO UPDATE SET 
          predicted_home_score = EXCLUDED.predicted_home_score,
          predicted_away_score = EXCLUDED.predicted_away_score,
          bet_amount = EXCLUDED.bet_amount,
          is_processed = false
      `, [userJwt.id, matchId, predictedHomeScore, predictedAwayScore, betAmount]);

      await query('COMMIT');

      return reply.send({
        success: true,
        message: 'Prediction bet submitted successfully'
      });
    } catch (err) {
      await query('ROLLBACK');
      request.log.error(err);
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to save prediction bet' });
    }
  });

  // 3. Get predictions made by current logged-in user
  server.get('/predictions/my', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const userJwt = request.user as { id: string; username: string };

    try {
      const res = await query('SELECT match_id, predicted_home_score, predicted_away_score, bet_amount, is_processed FROM predictions WHERE user_id = $1', [userJwt.id]);
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
      // Sorting order: descending points, then alphabetical by username for tie breaking
      const res = await query('SELECT username, points, wallet_balance FROM users ORDER BY points DESC, username ASC');
      const mapped = res.rows.map(row => ({
        ...row,
        total_points: row.points
      }));
      return reply.send({ success: true, leaderboard: mapped });
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
