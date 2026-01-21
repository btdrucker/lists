import { FastifyRequest, FastifyReply } from 'fastify';
import { auth } from '../services/firebase.js';
import { AuthUser } from '../types/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export async function authenticateUser(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    if (request.method === 'OPTIONS') {
      return reply.status(204).send();
    }

    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: 'Missing or invalid Authorization header',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decodedToken = await auth.verifyIdToken(token);
      
      request.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
      };
    } catch (error) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid or expired token',
      });
    }
  } catch (error) {
    return reply.status(500).send({
      success: false,
      error: 'Authentication error',
    });
  }
}

