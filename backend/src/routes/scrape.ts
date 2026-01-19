import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { scrapeRecipe } from '../services/scraper.js';
import { saveRecipe } from '../services/firestore.js';
import { authenticateUser } from '../middleware/auth.js';
import { ScrapeRequest, ScrapeResponse } from '../types/index.js';
import { fetchAiIngredientNormalization, fetchAiText } from '../services/ai.js';

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

  // AI health check endpoint (Vertex AI or API key path)
  fastify.get('/ai-health', async (request, reply) => {
    try {
      const sampleIngredients = ['1 cup diced tomatoes', '2 tsp olive oil'];
      const unitValues = ['cup', 'tsp'];
      const mode = process.env.GEMINI_API_KEY ? 'api-key' : 'vertex';
      const result = await fetchAiIngredientNormalization(sampleIngredients, unitValues);

      if (!result) {
        return reply.status(500).send({
          status: 'error',
          error: 'AI normalization failed or unavailable',
          mode,
          timestamp: new Date().toISOString(),
        });
      }

      return {
        status: 'ok',
        mode,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return reply.status(500).send({
        status: 'error',
        error: error instanceof Error ? error.message : 'AI health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // AI debug endpoint for prompt testing
  fastify.post(
    '/ai-debug',
    {
      preHandler: authenticateUser,
    },
    async (request, reply) => {
      try {
        const body = request.body as {
          systemInstruction?: string;
          userPrompt?: string;
          ingredientTexts?: string[];
          ingredients?: string[];
          text?: string;
          ingredientText?: string;
        };

        const systemInstruction =
          typeof body?.systemInstruction === 'string' ? body.systemInstruction.trim() : '';
        const userPrompt =
          typeof body?.userPrompt === 'string' ? body.userPrompt.trim() : '';
        let ingredientTexts: string[] = [];
        if (!userPrompt && Array.isArray(body?.ingredientTexts)) {
          ingredientTexts = body.ingredientTexts;
        } else if (!userPrompt && Array.isArray(body?.ingredients)) {
          ingredientTexts = body.ingredients;
        } else if (!userPrompt && typeof body?.ingredientText === 'string') {
          ingredientTexts = body.ingredientText.split(/\r?\n/);
        } else if (!userPrompt && typeof body?.text === 'string') {
          ingredientTexts = body.text.split(/\r?\n/);
        }

        ingredientTexts = ingredientTexts
          .map((value) => String(value).trim())
          .filter((value) => value.length > 0);

        if (!systemInstruction || (!userPrompt && !ingredientTexts.length)) {
          return reply.status(400).send({
            status: 'error',
            error: 'Provide systemInstruction and a user prompt or ingredient text.',
            timestamp: new Date().toISOString(),
          });
        }

        const resolvedUserPrompt =
          userPrompt ||
          ['Ingredients:', JSON.stringify(ingredientTexts, null, 2)].join('\n');
        const mode = process.env.GEMINI_API_KEY ? 'api-key' : 'vertex';
        const rawText = await fetchAiText(resolvedUserPrompt, { systemInstruction });

        if (!rawText) {
          return reply.status(500).send({
            status: 'error',
            error: 'AI request failed or unavailable',
            mode,
            timestamp: new Date().toISOString(),
          });
        }

        return {
          status: 'ok',
          mode,
          rawText,
          ingredientCount: ingredientTexts.length || null,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return reply.status(500).send({
          status: 'error',
          error: error instanceof Error ? error.message : 'AI debug request failed',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
}

