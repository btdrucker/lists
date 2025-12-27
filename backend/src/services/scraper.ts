import * as cheerio from 'cheerio';
import { Ingredient } from '../types/index.js';

interface ScrapedRecipe {
  title: string;
  description?: string;
  ingredients: Ingredient[];
  instructions: string[];
  imageUrl?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
}

export async function scrapeRecipe(url: string): Promise<ScrapedRecipe> {
  try {
    // Fetch the webpage
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try to extract recipe using JSON-LD schema (most reliable)
    const recipe = extractFromJsonLd($);
    if (recipe) {
      return recipe;
    }

    // Fallback to scraping HTML elements
    return extractFromHtml($, url);
  } catch (error) {
    console.error('Scraping error:', error);
    throw new Error(`Failed to scrape recipe: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function extractFromJsonLd($: cheerio.CheerioAPI): ScrapedRecipe | null {
  try {
    const scriptTags = $('script[type="application/ld+json"]');
    
    for (let i = 0; i < scriptTags.length; i++) {
      const scriptContent = $(scriptTags[i]).html();
      if (!scriptContent) continue;

      const jsonData = JSON.parse(scriptContent);
      const recipes = Array.isArray(jsonData) ? jsonData : [jsonData];

      for (const data of recipes) {
        if (data['@type'] === 'Recipe') {
          const recipe: ScrapedRecipe = {
            title: data.name || 'Untitled Recipe',
            ingredients: parseIngredientList(data.recipeIngredient || []),
            instructions: parseInstructions(data.recipeInstructions || []),
          };
          
          // Only add optional fields if they have values
          if (data.description) {
            recipe.description = data.description;
          }
          
          const imageUrl = getImageUrl(data.image);
          if (imageUrl) {
            recipe.imageUrl = imageUrl;
          }
          
          if (data.recipeYield) {
            const servings = parseInt(String(data.recipeYield));
            if (!isNaN(servings)) {
              recipe.servings = servings;
            }
          }
          
          const prepTime = parseDuration(data.prepTime);
          if (prepTime) {
            recipe.prepTime = prepTime;
          }
          
          const cookTime = parseDuration(data.cookTime);
          if (cookTime) {
            recipe.cookTime = cookTime;
          }
          
          return recipe;
        }
      }
    }
  } catch (error) {
    console.error('JSON-LD parsing error:', error);
  }

  return null;
}

function extractFromHtml($: cheerio.CheerioAPI, url: string): ScrapedRecipe {
  // Try to extract title
  const title = 
    $('h1[class*="recipe"]').first().text().trim() ||
    $('h1').first().text().trim() ||
    $('title').text().trim() ||
    'Untitled Recipe';

  // Try to extract description
  const descriptionText =
    $('meta[name="description"]').attr('content') ||
    $('p[class*="description"]').first().text().trim();

  // Try to extract ingredients
  const ingredients: string[] = [];
  $('li[class*="ingredient"], .ingredient, [itemprop="recipeIngredient"]').each((_, elem) => {
    const text = $(elem).text().trim();
    if (text) ingredients.push(text);
  });

  // Try to extract instructions
  const instructions: string[] = [];
  $('li[class*="instruction"], .instruction, [itemprop="recipeInstructions"] li, ol[class*="instruction"] li').each((_, elem) => {
    const text = $(elem).text().trim();
    if (text) instructions.push(text);
  });

  // If no list items found, try paragraphs
  if (instructions.length === 0) {
    $('[class*="instruction"] p, [class*="direction"] p').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text) instructions.push(text);
    });
  }

  // Extract image
  const imageUrlText = 
    $('meta[property="og:image"]').attr('content') ||
    $('img[class*="recipe"]').first().attr('src');

  const recipe: ScrapedRecipe = {
    title,
    ingredients: parseIngredientList(ingredients),
    instructions: instructions.length > 0 ? instructions : ['No instructions found. Please add manually.'],
  };
  
  // Only add optional fields if they have values
  if (descriptionText) {
    recipe.description = descriptionText;
  }
  
  if (imageUrlText) {
    recipe.imageUrl = imageUrlText;
  }
  
  return recipe;
}

function parseIngredientList(ingredients: string[]): Ingredient[] {
  return ingredients.map((text) => parseIngredient(text));
}

function parseIngredient(text: string): Ingredient {
  // Simple ingredient parser - can be improved with a dedicated library
  const cleaned = text.trim();
  
  // Try to extract amount and unit with regex
  const match = cleaned.match(/^(\d+(?:\/\d+)?(?:\.\d+)?(?:\s*-\s*\d+(?:\/\d+)?(?:\.\d+)?)?)\s*([a-zA-Z]+)?\s+(.+)$/);
  
  if (match) {
    const [, amountStr, unit, name] = match;
    const amount = parseFraction(amountStr.split('-')[0].trim());
    const amountMax = amountStr.includes('-') ? parseFraction(amountStr.split('-')[1].trim()) : undefined;
    
    return {
      amount,
      amountMax,
      unit: unit || null,
      name: name.trim(),
      originalText: cleaned,
    };
  }

  // If parsing fails, return as-is with just the name
  return {
    amount: null,
    unit: null,
    name: cleaned,
    originalText: cleaned,
  };
}

function parseFraction(str: string): number {
  if (str.includes('/')) {
    const [num, denom] = str.split('/').map(Number);
    return num / denom;
  }
  return parseFloat(str);
}

function parseInstructions(instructions: any[]): string[] {
  if (!Array.isArray(instructions)) {
    return [String(instructions)];
  }

  return instructions.map((instruction) => {
    if (typeof instruction === 'string') {
      return instruction;
    }
    if (instruction.text) {
      return instruction.text;
    }
    if (instruction['@type'] === 'HowToStep' && instruction.text) {
      return instruction.text;
    }
    return String(instruction);
  }).filter(Boolean);
}

function getImageUrl(image: any): string | undefined {
  if (typeof image === 'string') {
    return image;
  }
  if (Array.isArray(image) && image.length > 0) {
    return typeof image[0] === 'string' ? image[0] : image[0]?.url;
  }
  if (image?.url) {
    return image.url;
  }
  return undefined;
}

function parseDuration(duration?: string): number | undefined {
  if (!duration) return undefined;
  
  // Parse ISO 8601 duration (e.g., "PT30M", "PT1H30M")
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (match) {
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    return hours * 60 + minutes;
  }
  
  return undefined;
}

