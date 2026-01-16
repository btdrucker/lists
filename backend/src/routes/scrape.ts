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

        // Build recipe object, only including defined optional fields
        const recipeData: any = {
          userId: user.uid,
          title: scrapedRecipe.title,
          ingredients: scrapedRecipe.ingredients,
          instructions: scrapedRecipe.instructions,
          sourceUrl: url,
          isPublic: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Only add optional fields if they have values
        if (scrapedRecipe.description) recipeData.description = scrapedRecipe.description;
        if (scrapedRecipe.imageUrl) recipeData.imageUrl = scrapedRecipe.imageUrl;
        if (scrapedRecipe.servings !== undefined) recipeData.servings = scrapedRecipe.servings;
        if (scrapedRecipe.prepTime !== undefined) recipeData.prepTime = scrapedRecipe.prepTime;
        if (scrapedRecipe.cookTime !== undefined) recipeData.cookTime = scrapedRecipe.cookTime;
        if (scrapedRecipe.category && scrapedRecipe.category.length > 0) {
          recipeData.category = scrapedRecipe.category;
        }
        if (scrapedRecipe.cuisine && scrapedRecipe.cuisine.length > 0) {
          recipeData.cuisine = scrapedRecipe.cuisine;
        }
        if (scrapedRecipe.keywords && scrapedRecipe.keywords.length > 0) {
          recipeData.keywords = scrapedRecipe.keywords;
        }

        // Save to Firestore
        const recipe = await saveRecipe(recipeData);

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

