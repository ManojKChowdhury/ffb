import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import * as dotenv from 'dotenv';
import { initDb } from './db';
import { authRoutes } from './routes/auth';
import { fantasyRoutes } from './routes/fantasy';
import { simulationRoutes } from './routes/simulation';

dotenv.config();

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const host = process.env.HOST || '0.0.0.0';

const fastify = Fastify({
  logger: true
});

// Register Type Provider for Zod validation
fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

// Register CORS
fastify.register(cors, {
  origin: true, // Allow all origins for dev
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

// Register JWT
fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'super-secret-fantasy-key-123!@#'
});

// Register Route Groups
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(fantasyRoutes, { prefix: '/api' });

if (process.env.ENABLE_SIMULATION === 'true') {
  fastify.register(simulationRoutes, { prefix: '/api/simulation' });
}

// Add custom decorator for JWT authentication validation
fastify.decorate('authenticate', async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing authentication token' });
  }
});

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'healthy', timestamp: new Date().toISOString() };
});

const start = async () => {
  try {
    // 1. Initialize database schemas & indices
    await initDb();
    
    // 2. Start fastify server
    await fastify.listen({ port, host });
    console.log(`Fantasy Football Backend running on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
