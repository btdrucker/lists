import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { scrapeRecipe } from '../services/scraper.js';
import { saveRecipe } from '../services/firestore.js';
import { authenticateUser } from '../middleware/auth.js';
import { ScrapeRequest, ScrapeResponse } from '../types/index.js';
import { firestore } from '../services/firebase.js';

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
        console.log('Received scrape request');
        const { url } = request.body;
        console.log('URL to scrape:', url);

        if (!url) {
          console.log('Error: URL is required');
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
        console.log('User authenticated:', user.uid);

        // Scrape the recipe from the URL
        console.log('Starting scrape...');
        const scrapedRecipe = await scrapeRecipe(url);
        console.log('Scrape completed:', scrapedRecipe.title);

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

        // Test Firestore connectivity first
        console.log('Testing Firestore read...');
        try {
          const testSnapshot = await firestore.collection('recipes').limit(1).get();
          console.log('Firestore read test successful, found', testSnapshot.size, 'documents');
        } catch (readError) {
          console.error('Firestore read test failed:', readError);
          throw new Error('Cannot connect to Firestore');
        }
        
        // Save to Firestore
        console.log('Saving to Firestore...');
        const recipe = await saveRecipe(recipeData);
        console.log('Saved successfully with ID:', recipe.id);

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

