import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import bcrypt from 'bcryptjs';
import { RegistrationSchema, LoginSchema } from '@fantasy/shared';
import { query } from '../db';

export async function authRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<ZodTypeProvider>();

  // 1. User Registration
  server.post('/register', {
    schema: {
      body: RegistrationSchema
    }
  }, async (request, reply) => {
    const { username, password } = request.body;

    try {
      // Check if username is already taken
      const checkRes = await query('SELECT id FROM users WHERE username = $1', [username]);
      if (checkRes.rows.length > 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Username is already taken'
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Save user
      await query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
        [username, passwordHash]
      );

      return reply.status(201).send({
        success: true,
        message: 'Registration successful'
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to register user'
      });
    }
  });

  // 2. User Login
  server.post('/login', {
    schema: {
      body: LoginSchema
    }
  }, async (request, reply) => {
    const { username, password } = request.body;

    try {
      // Find user
      const userRes = await query('SELECT id, username, password_hash, wallet_balance, points, total_points FROM users WHERE username = $1', [username]);
      if (userRes.rows.length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid username or password'
        });
      }

      const user = userRes.rows[0];

      // Match password
      const passwordMatches = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatches) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid username or password'
        });
      }

      // Sign JWT
      const token = fastify.jwt.sign({
        id: user.id,
        username: user.username
      });

      return reply.send({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          wallet_balance: user.wallet_balance,
          points: user.points,
          total_points: user.points
        }
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to process login'
      });
    }
  });

  // 3. Get Current User Profiling (JWT Verification)
  server.get('/me', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const userJwt = request.user as { id: string; username: string };
    
    try {
      const userRes = await query('SELECT id, username, wallet_balance, points FROM users WHERE id = $1', [userJwt.id]);
      if (userRes.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User session not found in database'
        });
      }
      const user = userRes.rows[0];
      return reply.send({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          wallet_balance: user.wallet_balance,
          points: user.points,
          total_points: user.points
        }
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve profile details'
      });
    }
  });
}
