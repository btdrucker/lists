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
    console.log('[AUTH] Starting authentication');
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[AUTH] Missing or invalid auth header');
      return reply.status(401).send({
        success: false,
        error: 'Missing or invalid Authorization header',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('[AUTH] Token received, length:', token.length);

    try {
      console.log('[AUTH] Verifying token...');
      const decodedToken = await auth.verifyIdToken(token);
      console.log('[AUTH] Token verified for user:', decodedToken.uid);
      
      request.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
      };
    } catch (error) {
      console.log('[AUTH] Token verification failed:', error);
      return reply.status(401).send({
        success: false,
        error: 'Invalid or expired token',
      });
    }
  } catch (error) {
    console.log('[AUTH] Authentication error:', error);
    return reply.status(500).send({
      success: false,
      error: 'Authentication error',
    });
  }
}

