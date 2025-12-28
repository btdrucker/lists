import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { scrapeRoutes } from './routes/scrape.js';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3001');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'https://listster-8ffc9.web.app',
  'https://listster-8ffc9.firebaseapp.com',
  'https://listster-test.web.app',
  'https://listster-test.firebaseapp.com',
  FRONTEND_URL, // Add configured frontend URL
];

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

// Register CORS
await fastify.register(cors, {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    }
  },
  credentials: true,
});

// Register routes
await fastify.register(scrapeRoutes);

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📝 Health check: http://localhost:${PORT}/health`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

