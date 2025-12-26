import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { scrapeRecipe } from '../services/scraper.js';
import { saveRecipe } from '../services/firestore.js';
import { authenticateUser } from '../middleware/auth.js';
import { ScrapeRequest, ScrapeResponse } from '../types/index.js';

export async function scrapeRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Body: ScrapeRequest;
  }>(
    '/scrape',
    {
      preHandler: authenticateUser,
    },
    async (request: FastifyRequest<{ Body: ScrapeRequest }>, reply: FastifyReply) => {
      try {
        const { url } = request.body;

        if (!url) {
          return reply.status(400).send({
            success: false,
            error: 'URL is required',
          } as ScrapeResponse);
        }

        // Validate URL format
        try {
          new URL(url);
        } catch {
          return reply.status(400).send({
            success: false,
            error: 'Invalid URL format',
          } as ScrapeResponse);
        }

        const user = request.user!;

        // Scrape the recipe from the URL
        const scrapedRecipe = await scrapeRecipe(url);

        // Save to Firestore
        const recipe = await saveRecipe({
          userId: user.uid,
          title: scrapedRecipe.title,
          description: scrapedRecipe.description,
          ingredients: scrapedRecipe.ingredients,
          instructions: scrapedRecipe.instructions,
          sourceUrl: url,
          imageUrl: scrapedRecipe.imageUrl,
          servings: scrapedRecipe.servings,
          prepTime: scrapedRecipe.prepTime,
          cookTime: scrapedRecipe.cookTime,
          isPublic: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return reply.send({
          success: true,
          recipe,
        } as ScrapeResponse);
      } catch (error) {
        console.error('Scrape route error:', error);
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to scrape recipe',
        } as ScrapeResponse);
      }
    }
  );

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
}

