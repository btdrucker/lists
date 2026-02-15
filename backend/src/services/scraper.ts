import * as cheerio from 'cheerio';
import { Ingredient, RecipeContent, ExtractionMethod, UnitValue } from '../types/index.js';
import { fetchAiIngredientNormalization } from './ai.js';

// ScrapedRecipe extends RecipeContent with extraction metadata
interface ScrapedRecipe extends RecipeContent {
  extractionMethod?: ExtractionMethod;
}

// Unit aliases: enum unit → list of alias patterns seen in HTML
// Values are regex patterns (without anchors); matching is case-insensitive.
const UNIT_ALIAS_PATTERNS: Record<UnitValue, string[]> = {
  // Volume
  [UnitValue.CUP]: ['cups?','c\\.?'],
  [UnitValue.TABLESPOON]: ['tablespoons?', 'Tbsp\\.?', 'tbsp\\.?', 'tbs\\.?', 'T', 'TB'],
  [UnitValue.TEASPOON]: ['teaspoons?', 'tsp\\.?', 't'],
  [UnitValue.FLUID_OUNCE]: ['fluid ounces?', 'fl\\.?\\s*ozs?\\.?'],
  [UnitValue.QUART]: ['quarts?', 'qt\\.?'],
  // Weight
  [UnitValue.POUND]: ['pounds?', 'lbs?\\.?'],
  [UnitValue.WEIGHT_OUNCE]: ['ounces?', 'ozs?\\.?'],
  // Count/Pieces
  [UnitValue.EACH]: ['each'],
  [UnitValue.CLOVE]: ['cloves?'],
  [UnitValue.PIECE]: ['pieces?', 'slices?'],
  [UnitValue.CAN]: ['cans?'],
  [UnitValue.BUNCH]: ['bunches?'],
  [UnitValue.HEAD]: ['heads?'],
  [UnitValue.STALK]: ['stalks?'],
  [UnitValue.SPRIG]: ['sprigs?'],
  [UnitValue.LEAF]: ['leaves?'],
  // Special
  [UnitValue.PINCH]: ['pinches?'],
  [UnitValue.DASH]: ['dashes?'],
  [UnitValue.HANDFUL]: ['handfuls?'],
  [UnitValue.TO_TASTE]: ['to\\s*taste'],
};

const UNIT_ALIAS_MATCHERS = Object.entries(UNIT_ALIAS_PATTERNS).flatMap(
  ([unit, patterns]) => patterns.map((pattern) => ({
    unit: unit as UnitValue,
    regex: new RegExp(`^(${pattern})(?=\\s|$|[),;:])`, 'i'),
  }))
);

const UNIT_VALUE_SET = new Set(Object.values(UnitValue));

/**
 * Normalize Unicode fractions to ASCII format using NFKD normalization
 * E.g., "¼" → "1/4", "½" → "1/2"
 * 
 * NFKD decomposition turns "¼" into "1⁄4" (using the special fraction slash U+2044)
 * We then replace the special Unicode fraction slash with an ASCII forward slash
 */
function normalizeFractions(input: string): string {
  // Insert a space between whole number and Unicode fraction (e.g., "1½" -> "1 ½")
  const separated = input.replace(/(\d)([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, '$1 $2');

  // 1. Decompose characters using NFKD normalization
  // This turns "¼" into "1⁄4" (using the special fraction slash U+2044)
  const decomposed = separated.normalize("NFKD");

  // 2. Replace the special Unicode fraction slash (U+2044) with an ASCII forward slash (U+002F)
  // The fraction slash character is different from a standard forward slash
  const normalized = decomposed.replace(/\u2044/g, '/');

  return normalized;
}

/**
 * Parse a single amount string (no ranges)
 * Handles Unicode fractions (e.g., "½" → "1/2") and mixed fractions (e.g., "1 1/2")
 * 
 * @param amountStr - A single amount string (should not contain ranges)
 * @param parseFunc - The parsing function to use (parseFraction for text, parseFloat for decimals)
 * @returns Parsed number or null
 */
function parseSingleAmount(
  amountStr: string,
  parseFunc: (str: string) => number | null = parseFraction
): number | null {
  // Normalize Unicode fractions (e.g., "½" → "1/2")
  const normalized = normalizeFractions(amountStr);
  
  // Check for mixed fractions like "1 1/2" (only when using parseFraction)
  if (parseFunc === parseFraction) {
    const mixedMatch = normalized.match(/^(\d+)\s+(\d+\/\d+)$/);
    if (mixedMatch) {
      const whole = parseFloat(mixedMatch[1]);
      const frac = parseFraction(mixedMatch[2]);
      return frac !== null ? whole + frac : whole;
    }
  }
  
  // Parse the normalized string
  return parseFunc(normalized);
}

function validateAiUnit(value: unknown, originalText: string): UnitValue | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined') return null;
  
  // Map legacy OUNCE to WEIGHT_OUNCE for backward compatibility
  if (trimmed === 'OUNCE') {
    return UnitValue.WEIGHT_OUNCE;
  }
  
  if (UNIT_VALUE_SET.has(trimmed as UnitValue)) {
    return trimmed as UnitValue;
  }
  console.warn('[ingredient-ai] invalid unit from AI', {
    unit: value,
    ingredient: originalText,
  });
  return null;
}

function validateAiAmount(value: unknown, originalText: string): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value !== null && value !== undefined) {
    console.warn('[ingredient-ai] invalid amount from AI', {
      amount: value,
      ingredient: originalText,
    });
  }
  return null;
}

/**
 * Detect if an amount string contains a range and split it
 * E.g., "1-2" → { isRange: true, min: "1", max: "2" }
 * E.g., "½" → { isRange: false, value: "½" }
 * 
 * @param amountStr - The amount string to check
 * @returns Object indicating if it's a range and the value(s)
 */
function splitAmountRange(amountStr: string): 
  | { isRange: false; value: string }
  | { isRange: true; min: string; max: string } {
  
  // Check if there's a range (before normalizing, to avoid confusion with fractions like "1/2")
  if (amountStr.includes('-')) {
    // Handle ranges like "1-2" or "½-1" or "1 1/2 - 2 1/2"
    const parts = amountStr.split('-').map(s => s.trim());
    if (parts.length === 2) {
      return {
        isRange: true,
        min: parts[0],
        max: parts[1],
      };
    }
  }
  
  // No range - single value
  return {
    isRange: false,
    value: amountStr,
  };
}

/**
 * Parse an amount string that may contain ranges (e.g., "1-2", "½-1") or mixed fractions (e.g., "1 1/2")
 * Each part of a range gets full parsing/normalization treatment
 * 
 * @param amountStr - The amount string to parse (may contain Unicode fractions and/or ranges)
 * @param parseFunc - The parsing function to use (parseFraction for text, parseFloat for decimals)
 * @returns Object with amount and optional amountMax
 */
function parseAmountWithRange(
  amountStr: string,
  parseFunc: (str: string) => number | null = parseFraction
): { amount: number | null; amountMax?: number | null } {
  const split = splitAmountRange(amountStr);
  
  if (split.isRange) {
    // Parse each side of the range with full normalization and mixed fraction handling
    return {
      amount: parseSingleAmount(split.min, parseFunc),
      amountMax: parseSingleAmount(split.max, parseFunc),
    };
  } else {
    // No range - parse as single amount
    return {
      amount: parseSingleAmount(split.value, parseFunc),
    };
  }
}

/**
 * Meal-type keywords that should be extracted from keywords and moved to category
 * Case-insensitive matching, but use these exact capitalizations when adding to category
 */
const CATEGORY_KEYWORDS = [
  'Appetizer',
  'Breakfast',
  'Brunch',
  'Dessert',
  'Dinner',
  'Drink',
  'Entree',
  'Lunch',
  'Main',
  'Main course',
  'Sauce',
  'Side',
  'Side dish',
  'Snack',
  'Starter',
];

/**
 * Cuisine keywords that should be extracted from keywords and moved to cuisine
 * Case-insensitive matching, but use these exact capitalizations when adding to cuisine
 */
const CUISINE_KEYWORDS = [
  'American',
  'British',
  'Thai',
  'Mexican',
  'Chinese',
  'Indian',
  'Israeli',
  'Italian',
  'Japanese',
  'Mediterranean',
  'French',
  'Spanish',
  'Greek',
  'Turkish',
  'African',
  'Middle Eastern',
  'Latin American',
  'Caribbean',
  // Add more as needed.
];

/**
 * Normalize metadata by extracting meal-type and cuisine terms from keywords
 * and moving them to their respective arrays
 */
function normalizeMetadata(
  rawCategory: string[] = [],
  rawCuisine: string[] = [],
  rawKeywords: string[] = []
): {
  category: string[];
  cuisine: string[];
  keywords: string[];
} {
  const categorySet = new Set<string>(rawCategory);
  const cuisineSet = new Set<string>(rawCuisine);
  const remainingKeywords: string[] = [];

  // Create lowercase lookup maps for case-insensitive matching
  const categoryLookup = new Map<string, string>();
  CATEGORY_KEYWORDS.forEach(cat => {
    categoryLookup.set(cat.toLowerCase(), cat);
  });

  const cuisineLookup = new Map<string, string>();
  CUISINE_KEYWORDS.forEach(cui => {
    cuisineLookup.set(cui.toLowerCase(), cui);
  });

  // Process each keyword
  for (const keyword of rawKeywords) {
    const trimmed = keyword.trim();
    if (!trimmed) continue;

    const lowerKeyword = trimmed.toLowerCase();

    // Check if it's a category keyword
    const categoryMatch = categoryLookup.get(lowerKeyword);
    if (categoryMatch) {
      categorySet.add(categoryMatch);
      continue;
    }

    // Check if it's a cuisine keyword
    const cuisineMatch = cuisineLookup.get(lowerKeyword);
    if (cuisineMatch) {
      cuisineSet.add(cuisineMatch);
      continue;
    }

    // Not a special keyword, keep it
    remainingKeywords.push(trimmed);
  }

  return {
    category: Array.from(categorySet),
    cuisine: Array.from(cuisineSet),
    keywords: remainingKeywords,
  };
}

/**
 * Parse keywords from various formats (string or array)
 */
function parseKeywords(keywords: any): string[] {
  if (!keywords) return [];
  
  if (typeof keywords === 'string') {
    // Split on commas and trim
    return keywords.split(',').map(k => k.trim()).filter(k => k);
  }
  
  if (Array.isArray(keywords)) {
    return keywords.map(k => String(k).trim()).filter(k => k);
  }
  
  return [];
}

/**
 * Parse category/cuisine values from string or array formats
 */
function parseStringArray(value: any): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(item => item);
  }

  if (typeof value === 'string') {
    return value.split(',').map(item => item.trim()).filter(item => item);
  }

  return [String(value).trim()].filter(item => item);
}

function isJsonLdRecipeType(typeValue: unknown): boolean {
  const typeArray = Array.isArray(typeValue) ? typeValue : [typeValue];
  return typeArray.includes('Recipe') || typeArray.includes('EditRecipe');
}

/**
 * Helper to log recipe sample data
 * Always shows all fields, indicating when values are missing
 */
function logRecipeSample(recipe: ScrapedRecipe): void {
  console.log('Title:', recipe.title || 'N/A');
  console.log('Description:', recipe.description ? recipe.description.substring(0, 100) + '...' : 'N/A');
  console.log('Image URL:', recipe.imageUrl || 'N/A');
  console.log('Servings:', recipe.servings ?? 'N/A');
  console.log('Prep Time:', recipe.prepTime ? `${recipe.prepTime} min` : 'N/A');
  console.log('Cook Time:', recipe.cookTime ? `${recipe.cookTime} min` : 'N/A');
  console.log('Category:', recipe.category?.join(', ') || 'N/A');
  console.log('Cuisine:', recipe.cuisine?.join(', ') || 'N/A');
  console.log('Keywords:', recipe.keywords?.length ? recipe.keywords.slice(0, 5).join(', ') + (recipe.keywords.length > 5 ? '...' : '') : 'N/A');
  console.log('Ingredients count:', recipe.ingredients.length);
  console.log('Sample ingredients:');
  recipe.ingredients.slice(0, 3).forEach((ing, i) => {
    console.log(`  [${i}]`, JSON.stringify(ing, null, 2));
  });
  if (process.env.DEBUG_INGREDIENT_PARSING === 'true') {
    console.log('All ingredients (with confidence):');
    recipe.ingredients.forEach((ing, i) => {
      console.log(`  [${i}]`, JSON.stringify({
        amount: ing.amount,
        amountMax: ing.amountMax,
        unit: ing.unit,
        name: ing.name,
        section: ing.section,
        originalText: ing.originalText,
        parseConfidence: ing.parseConfidence,
        aiAmount: ing.aiAmount,
        aiUnit: ing.aiUnit,
        aiName: ing.aiName,
      }, null, 2));
    });
  }
  console.log('Instructions count:', recipe.instructions.length);
}

export async function enrichIngredientsWithAI(
  ingredients: Ingredient[]
): Promise<Ingredient[]> {
  if (!ingredients.length) return ingredients;

  const ingredientTexts = ingredients.map((ing) => ing.originalText || ing.name);
  const aiResults = await fetchAiIngredientNormalization(
    ingredientTexts,
    Object.values(UnitValue)
  );
  if (!aiResults) return ingredients;

  return ingredients.map((ing, idx) => {
    const ai = aiResults[idx] || {};
    const aiAmount = validateAiAmount(ai.amount, ing.originalText || ing.name);
    const aiUnit = validateAiUnit(ai.unit, ing.originalText || ing.name);
    const aiName = ai.name ? String(ai.name).trim() : null;
    
    if (process.env.DEBUG_INGREDIENT_PARSING === 'true') {
      console.log(`[ingredient-ai] Processing "${ing.originalText || ing.name}":`, {
        rawAiResponse: ai,
        validated: { aiAmount, aiUnit, aiName },
      });
    }
    
    return {
      ...ing,
      aiAmount,
      aiUnit,
      aiName,
    };
  });
}

async function normalizeIngredientsWithAI(recipe: ScrapedRecipe): Promise<ScrapedRecipe> {
  if (!recipe.ingredients.length) return recipe;

  const enriched = await enrichIngredientsWithAI(recipe.ingredients);
  if (enriched === recipe.ingredients) return recipe;

  return {
    ...recipe,
    ingredients: enriched,
  };
}

/**
 * Scrape recipe from HTML content (useful for testing with fixtures)
 */
export async function scrapeRecipeFromHTML(
  html: string,
  url: string,
  options?: { useAi?: boolean }
): Promise<ScrapedRecipe> {
  const shouldUseAi = options?.useAi ?? false;
  try {
    const $ = cheerio.load(html);

    // Detect recipe plugins/formats
    console.log('\n=== RECIPE PLUGIN DETECTION ===');
    console.log('WPRM (WP Recipe Maker):', !!$('.wprm-recipe').length);
    console.log('Tasty Recipes:', !!$('.tasty-recipes').length);
    console.log('WP Recipe Card:', !!$('.wp-block-recipe-card').length);
    console.log('Mediavine Create:', !!$('.mv-create-card').length);
    console.log('EasyRecipe:', !!$('.easyrecipe').length);

    // Try extraction methods in priority order
    console.log('\n========================================');
    console.log('EXTRACTION HIERARCHY');
    console.log('========================================');

    // Priority 1: WPRM (fully structured)
    console.log('\n--- Trying WPRM extraction ---');
    const wprmRecipe = extractFromWPRM($);
    if (wprmRecipe) {
      console.log('✓ WPRM extraction successful');
      const normalized = shouldUseAi
        ? await normalizeIngredientsWithAI(wprmRecipe)
        : wprmRecipe;
      logRecipeSample(normalized);
      console.log('\n✅ Using WPRM extraction');
      normalized.extractionMethod = 'WPRM';
      return normalized;
    }
    console.log('✗ WPRM not detected');

    // Priority 2: Data attributes (fully structured)
    console.log('\n--- Trying data attribute extraction ---');
    const dataAttrRecipe = extractFromDataAttributes($);
    if (dataAttrRecipe && dataAttrRecipe.ingredients.length > 0) {
      console.log('✓ Data attribute extraction successful');
      const normalized = shouldUseAi
        ? await normalizeIngredientsWithAI(dataAttrRecipe)
        : dataAttrRecipe;
      logRecipeSample(normalized);
      console.log('\n✅ Using data attribute extraction');
      normalized.extractionMethod = 'DataAttributes';
      return normalized;
    }
    console.log('✗ Data attributes not found');

    // Priority 3: JSON-LD (good metadata, text parsing for ingredients)
    console.log('\n--- Trying JSON-LD extraction ---');
    const jsonLdRecipe = extractFromJsonLd($);
    if (jsonLdRecipe) {
      console.log('✓ JSON-LD extraction successful');
      const normalized = shouldUseAi
        ? await normalizeIngredientsWithAI(jsonLdRecipe)
        : jsonLdRecipe;
      logRecipeSample(normalized);
      console.log('\n✅ Using JSON-LD extraction (with text parsing)');
      normalized.extractionMethod = 'JSON-LD';
      return normalized;
    }
    console.log('✗ JSON-LD not found');

    // Priority 4: Generic HTML (fallback, text parsing)
    console.log('\n--- Falling back to generic HTML extraction ---');
    const htmlRecipe = extractFromHtml($, url);
    console.log('✓ HTML extraction complete');
    const normalized = shouldUseAi
      ? await normalizeIngredientsWithAI(htmlRecipe)
      : htmlRecipe;
    logRecipeSample(normalized);
    console.log('\n✅ Using HTML extraction (with text parsing)');
    normalized.extractionMethod = 'HTML';
    
    console.log('\n========================================\n');
    return normalized;
  } catch (error) {
    console.error('Scraping error:', error);
    throw new Error(`Failed to scrape recipe: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch HTML from a URL
 * @param url - The URL to fetch
 * @returns The HTML text content
 */
async function fetchHTML(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.statusText}`);
  }
  return await response.text();
}

/**
 * Scrape recipe from URL (fetches HTML then processes)
 */
export async function scrapeRecipe(
  url: string,
  options?: { useAi?: boolean }
): Promise<ScrapedRecipe> {
  const html = await fetchHTML(url);
  try {
    return await scrapeRecipeFromHTML(html, url, options);
  } catch (error) {
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
      
      // Handle @graph structure (common in WordPress sites)
      let recipes = Array.isArray(jsonData) ? jsonData : [jsonData];
      if (jsonData['@graph']) {
        recipes = jsonData['@graph'];
      }

      for (const data of recipes) {
        const isRecipe = isJsonLdRecipeType(data['@type']);
        
        if (isRecipe) {
          // Debug: Check JSON-LD ingredient format
          console.log('\n=== JSON-LD INGREDIENT FORMAT ===');
          if (data.recipeIngredient && data.recipeIngredient.length > 0) {
            const firstIng = data.recipeIngredient[0];
            console.log('First ingredient type:', typeof firstIng);
            console.log('Is PropertyValue:', firstIng?.['@type'] === 'PropertyValue');
            console.log('Sample raw ingredient:', JSON.stringify(firstIng, null, 2));
          }
          
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
          
          // Extract and normalize metadata (category, cuisine, keywords)
          const rawCategory = parseStringArray(data.recipeCategory);
          const rawCuisine = parseStringArray(data.recipeCuisine);
          const rawKeywords = parseKeywords(data.keywords);
          
          const normalized = normalizeMetadata(rawCategory, rawCuisine, rawKeywords);
          
          if (normalized.category.length > 0) {
            recipe.category = normalized.category;
          }
          if (normalized.cuisine.length > 0) {
            recipe.cuisine = normalized.cuisine;
          }
          if (normalized.keywords.length > 0) {
            recipe.keywords = normalized.keywords;
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
  // Debug: Check HTML ingredient structure
  console.log('\n=== HTML INGREDIENT STRUCTURE ===');
  const firstIngredient = $('li[class*="ingredient"], .ingredient, [itemprop="recipeIngredient"]').first();
  if (firstIngredient.length) {
    console.log('First ingredient classes:', firstIngredient.attr('class') || 'none');
    console.log('Has amount span:', !!firstIngredient.find('[class*="amount"]').length);
    console.log('Has unit span:', !!firstIngredient.find('[class*="unit"]').length);
    console.log('Has name span:', !!firstIngredient.find('[class*="name"]').length);
    console.log('Has notes span:', !!firstIngredient.find('[class*="notes"]').length);
    console.log('Full HTML:', firstIngredient.html()?.substring(0, 200) + '...');
  } else {
    console.log('No ingredient elements found');
  }
  
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
  $('li[class*="instruction"], li[class*="direction"], li[class*="step"], .instruction, [itemprop="recipeInstructions"] li, ol[class*="instruction"] li, ol[class*="direction"] li, ol[class*="step"] li').each((_, elem) => {
    const text = $(elem).text().trim();
    if (text) instructions.push(cleanListItemText(text));
  });

  // Try Dotdash/AllRecipes pattern (mntl-sc-block)
  if (instructions.length === 0) {
    $('.mntl-sc-block-group--OL li.mntl-sc-block-group--LI p.mntl-sc-block-html').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text) instructions.push(cleanListItemText(text));
    });
  }

  // If no list items found, try paragraphs
  if (instructions.length === 0) {
    $('[class*="instruction"] p, [class*="direction"] p, [class*="step"] p').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text) instructions.push(cleanListItemText(text));
    });
  }

  // Extract image
  const imageUrlText = 
    $('meta[property="og:image"]').attr('content') ||
    $('img[class*="recipe"]').first().attr('data-lazy-src') ||
    $('img[class*="recipe"]').first().attr('data-src') ||
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
  
  // Try to extract servings, prepTime, cookTime from generic HTML patterns
  console.log('\n--- Extracting metadata from HTML (generic extraction) ---');
  const metadata = extractMetadataFromHTML($);
  if (metadata.servings) {
    recipe.servings = metadata.servings;
    console.log('  ✓ Found servings in HTML:', metadata.servings);
  }
  if (metadata.prepTime) {
    recipe.prepTime = metadata.prepTime;
    console.log('  ✓ Found prep time in HTML:', metadata.prepTime, 'minutes');
  }
  if (metadata.cookTime) {
    recipe.cookTime = metadata.cookTime;
    console.log('  ✓ Found cook time in HTML:', metadata.cookTime, 'minutes');
  }
  
  // Try to get servings, prepTime, cookTime from JSON-LD if not found yet
  if (!recipe.servings || !recipe.prepTime || !recipe.cookTime) {
    console.log('\n--- Supplementary data from JSON-LD (HTML extraction) ---');
  try {
    const scriptTags = $('script[type="application/ld+json"]');
    console.log(`Found ${scriptTags.length} JSON-LD script tags`);
    
    for (let i = 0; i < scriptTags.length; i++) {
      const scriptContent = $(scriptTags[i]).html();
      if (!scriptContent) continue;
      
      const jsonData = JSON.parse(scriptContent);
      let recipes = Array.isArray(jsonData) ? jsonData : [jsonData];
      if (jsonData['@graph']) {
        recipes = jsonData['@graph'];
      }
      
      for (const data of recipes) {
        const isRecipe = isJsonLdRecipeType(data['@type']);
        
        if (isRecipe) {
          console.log('Found Recipe in JSON-LD');
          console.log('  recipeYield:', data.recipeYield);
          console.log('  prepTime:', data.prepTime);
          console.log('  cookTime:', data.cookTime);
          
          if (data.recipeYield && !recipe.servings) {
            const servings = parseInt(String(data.recipeYield));
            if (!isNaN(servings)) {
              recipe.servings = servings;
              console.log('  ✓ Extracted servings:', servings);
            }
          }
          
          if (data.prepTime && !recipe.prepTime) {
            const prepTime = parseDuration(data.prepTime);
            if (prepTime) {
              recipe.prepTime = prepTime;
              console.log('  ✓ Extracted prepTime:', prepTime, 'minutes');
            }
          }
          
          if (data.cookTime && !recipe.cookTime) {
            const cookTime = parseDuration(data.cookTime);
            if (cookTime) {
              recipe.cookTime = cookTime;
              console.log('  ✓ Extracted cookTime:', cookTime, 'minutes');
            }
          }
          
          break;
        }
      }
    }
  } catch (error) {
    console.log('Error extracting supplementary data from JSON-LD:', error);
  }
  }
  
  // Extract metadata from HTML meta tags and JSON-LD
  console.log('\n--- Extracting metadata (category, cuisine, keywords) ---');
  let rawCategory: string[] = [];
  let rawCuisine: string[] = [];
  let rawKeywords: string[] = [];
  
  // Try meta tags first
  const metaKeywords = $('meta[name="keywords"]').attr('content');
  if (metaKeywords) {
    rawKeywords = parseKeywords(metaKeywords);
    console.log('  Found keywords in meta tag:', rawKeywords.length);
  }
  
  const metaSection = $('meta[name="article:section"]').attr('content');
  if (metaSection) {
    rawCategory.push(metaSection);
    console.log('  Found category in meta tag:', metaSection);
  }
  
  // Try to get from JSON-LD if available
  try {
    const scriptTags = $('script[type="application/ld+json"]');
    for (let i = 0; i < scriptTags.length; i++) {
      const scriptContent = $(scriptTags[i]).html();
      if (!scriptContent) continue;
      
      const jsonData = JSON.parse(scriptContent);
      let recipes = Array.isArray(jsonData) ? jsonData : [jsonData];
      if (jsonData['@graph']) {
        recipes = jsonData['@graph'];
      }
      
      for (const data of recipes) {
        const isRecipe = isJsonLdRecipeType(data['@type']);
        
        if (isRecipe) {
          if (data.recipeCategory) {
            const parsedCategory = parseStringArray(data.recipeCategory);
            if (parsedCategory.length > 0) {
              rawCategory = [...rawCategory, ...parsedCategory];
              console.log('  Found category in JSON-LD:', parsedCategory);
            }
          }
          if (data.recipeCuisine) {
            const parsedCuisine = parseStringArray(data.recipeCuisine);
            if (parsedCuisine.length > 0) {
              rawCuisine = [...rawCuisine, ...parsedCuisine];
              console.log('  Found cuisine in JSON-LD:', parsedCuisine);
            }
          }
          if (data.keywords && rawKeywords.length === 0) {
            rawKeywords = parseKeywords(data.keywords);
            console.log('  Found keywords in JSON-LD:', rawKeywords.length);
          }
          break;
        }
      }
    }
  } catch (error) {
    console.log('  Error extracting metadata from JSON-LD:', error);
  }
  
  // Normalize metadata
  const normalized = normalizeMetadata(rawCategory, rawCuisine, rawKeywords);
  if (normalized.category.length > 0) {
    recipe.category = normalized.category;
    console.log('  ✓ Category:', normalized.category.join(', '));
  }
  if (normalized.cuisine.length > 0) {
    recipe.cuisine = normalized.cuisine;
    console.log('  ✓ Cuisine:', normalized.cuisine.join(', '));
  }
  if (normalized.keywords.length > 0) {
    recipe.keywords = normalized.keywords;
    console.log('  ✓ Keywords:', normalized.keywords.slice(0, 5).join(', ') + (normalized.keywords.length > 5 ? '...' : ''));
  }
  
  return recipe;
}

function extractFromDataAttributes($: cheerio.CheerioAPI): ScrapedRecipe | null {
  // Check if this site uses data-ingredient-* attributes
  const ingredientElements = $('[data-ingredient-quantity], [data-ingredient-name]');
  if (!ingredientElements.length) {
    return null;
  }

  // Extract title
  const title = 
    $('h1[class*="recipe"]').first().text().trim() ||
    $('h1').first().text().trim() ||
    $('title').text().trim() ||
    'Untitled Recipe';

  // Extract ingredients with data attributes (with section support)
  const ingredients: Ingredient[] = [];
  const processedElements = new Set<any>();

  // Build a map of sections by looking for headings before ingredient lists
  const sectionMap = new Map<any, string>();
  
  // AllRecipes uses specific class for ingredient section headings
  $('.mm-recipes-structured-ingredients__list-heading').each((_, header) => {
    const $header = $(header);
    const headerText = $header.text().trim();
    
    // The next sibling should be the ul.mm-recipes-structured-ingredients__list
    const $list = $header.next('ul.mm-recipes-structured-ingredients__list');
    if ($list.length) {
      $list.find('[data-ingredient-name]').each((_, ing) => {
        sectionMap.set(ing, headerText);
      });
    }
  });
  
  // Generic fallback for other sites using h2/h3/h4/strong
  $('h2, h3, h4, strong').each((_, header) => {
    const $header = $(header);
    const headerText = $header.text().trim();
    
    // Look for ingredients after this header
    let $next = $header.next();
    let foundIngredients = false;
    
    // Check next few siblings for ingredients
    for (let i = 0; i < 5 && $next.length; i++) {
      const hasIngredients = $next.find('[data-ingredient-name]').length > 0 || 
                            $next.is('[data-ingredient-name]');
      if (hasIngredients) {
        foundIngredients = true;
        // Mark all ingredients in this container with this section
        $next.find('[data-ingredient-name]').each((_, ing) => {
          sectionMap.set(ing, headerText);
        });
        if ($next.is('[data-ingredient-name]')) {
          sectionMap.set($next[0], headerText);
        }
      }
      $next = $next.next();
    }
  });

  $('[data-ingredient-name]').each((_, elem) => {
    if (processedElements.has(elem)) return;
    processedElements.add(elem);

    const $elem = $(elem);
    const $parent = $elem.closest('li, p, div');

    // Look for quantity and unit in the same parent or nearby
    const quantity = $parent.find('[data-ingredient-quantity]').first().text().trim();
    const unit = $parent.find('[data-ingredient-unit]').first().text().trim();
    const name = $elem.text().trim();
    const nameSpanCount = $parent.find('[data-ingredient-name]').length;
    const section = sectionMap.get(elem);

    if (name) {
      // Parse amount (handle ranges and fractions)
      let parsedAmount: number | null = null;
      let parsedAmountMax: number | null = null;

      if (quantity) {
        const parsed = parseAmountWithRange(quantity);
        parsedAmount = parsed.amount;
        parsedAmountMax = parsed.amountMax || null;
      }

      // Build original text
      const parts = [quantity, unit, name].filter(p => p);
      const originalText = parts.join(' ');

      const normalizedUnit = normalizeUnitText(unit);

      const baseConfidence = scoreIngredientParse({
        hasAmount: parsedAmount !== null,
        hasUnit: normalizedUnit !== null,
        normalizedBySize: false,
        hadAmountMatch: !!quantity,
        hasName: !!name,
      });
      ingredients.push({
        amount: parsedAmount,
        amountMax: parsedAmountMax || undefined,
        unit: normalizedUnit,
        name: name,
        section: section,
        originalText: originalText,
        parseConfidence: applyConfidencePenalties(baseConfidence, {
          hasMultipleNames: nameSpanCount > 1,
          hasFromClause: /\bfrom\b/i.test(originalText),
        }),
      });
    }
  });

  // Extract instructions
  const instructions: string[] = [];
  $('li[class*="instruction"], li[class*="direction"], li[class*="step"], .instruction, [itemprop="recipeInstructions"] li, ol[class*="instruction"] li, ol[class*="direction"] li, ol[class*="step"] li').each((_, elem) => {
    const text = $(elem).text().trim();
    if (text) {
      instructions.push(cleanListItemText(text));
    }
  });

  // Try Dotdash/AllRecipes pattern (mntl-sc-block)
  if (instructions.length === 0) {
    $('.mntl-sc-block-group--OL li.mntl-sc-block-group--LI p.mntl-sc-block-html').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text) {
        instructions.push(cleanListItemText(text));
      }
    });
  }

  // Generic fallback
  if (instructions.length === 0) {
    $('[class*="instruction"] p, [class*="direction"] p, [class*="step"] p').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text) {
        instructions.push(cleanListItemText(text));
      }
    });
  }

  // Build recipe object
  const recipe: ScrapedRecipe = {
    title,
    ingredients,
    instructions,
  };

  // Extract optional fields
  const description = $('meta[name="description"]').attr('content') || $('p[class*="description"]').first().text().trim();
  if (description) {
    recipe.description = description;
  }

  const imageUrl = 
    $('meta[property="og:image"]').attr('content') ||
    $('img[class*="recipe"]').first().attr('data-lazy-src') ||
    $('img[class*="recipe"]').first().attr('data-src') ||
    $('img[class*="recipe"]').first().attr('src');
  if (imageUrl) {
    recipe.imageUrl = imageUrl;
  }

  // Try to extract servings, prepTime, cookTime from generic HTML patterns
  console.log('\n--- Extracting metadata from HTML ---');
  const metadata = extractMetadataFromHTML($);
  if (metadata.servings) {
    recipe.servings = metadata.servings;
    console.log('  ✓ Found servings in HTML:', metadata.servings);
  }
  if (metadata.prepTime) {
    recipe.prepTime = metadata.prepTime;
    console.log('  ✓ Found prep time in HTML:', metadata.prepTime, 'minutes');
  }
  if (metadata.cookTime) {
    recipe.cookTime = metadata.cookTime;
    console.log('  ✓ Found cook time in HTML:', metadata.cookTime, 'minutes');
  }

  // Try to get servings, prepTime, cookTime from JSON-LD if not found yet
  if (!recipe.servings || !recipe.prepTime || !recipe.cookTime) {
    console.log('\n--- Supplementary data from JSON-LD ---');
  try {
    const scriptTags = $('script[type="application/ld+json"]');
    console.log(`Found ${scriptTags.length} JSON-LD script tags`);
    
    for (let i = 0; i < scriptTags.length; i++) {
      const scriptContent = $(scriptTags[i]).html();
      if (!scriptContent) {
        console.log(`  Script ${i}: empty`);
        continue;
      }
      
      const jsonData = JSON.parse(scriptContent);
      console.log(`  Script ${i} @type:`, jsonData['@type']);
      console.log(`  Script ${i} has @graph:`, !!jsonData['@graph']);
      
      let recipes = Array.isArray(jsonData) ? jsonData : [jsonData];
      if (jsonData['@graph']) {
        recipes = jsonData['@graph'];
        console.log(`  @graph contains ${recipes.length} items`);
        recipes.forEach((item: any, idx: number) => {
          console.log(`    Item ${idx} @type:`, item['@type']);
        });
      }
      
      for (const data of recipes) {
        const isRecipe = isJsonLdRecipeType(data['@type']);
        
        if (isRecipe) {
          console.log('✓ Found Recipe in JSON-LD');
          console.log('  recipeYield:', data.recipeYield);
          console.log('  prepTime:', data.prepTime);
          console.log('  cookTime:', data.cookTime);
          
          if (data.recipeYield && !recipe.servings) {
            const servings = parseInt(String(data.recipeYield));
            if (!isNaN(servings)) {
              recipe.servings = servings;
              console.log('  ✓ Extracted servings:', servings);
            }
          }
          
          if (data.prepTime && !recipe.prepTime) {
            const prepTime = parseDuration(data.prepTime);
            if (prepTime) {
              recipe.prepTime = prepTime;
              console.log('  ✓ Extracted prepTime:', prepTime, 'minutes');
            }
          }
          
          if (data.cookTime && !recipe.cookTime) {
            const cookTime = parseDuration(data.cookTime);
            if (cookTime) {
              recipe.cookTime = cookTime;
              console.log('  ✓ Extracted cookTime:', cookTime, 'minutes');
            }
          }
          
          break;
        }
      }
    }
  } catch (error) {
    console.log('Error extracting supplementary data from JSON-LD:', error);
  }
  }

  console.log('\n--- Final recipe metadata ---');
  console.log('Servings:', recipe.servings || 'not set');
  console.log('Prep time:', recipe.prepTime ? `${recipe.prepTime} minutes` : 'not set');
  console.log('Cook time:', recipe.cookTime ? `${recipe.cookTime} minutes` : 'not set');

  // Extract and normalize metadata (category, cuisine, keywords)
  console.log('\n--- Extracting metadata (category, cuisine, keywords) ---');
  let rawCategory: string[] = [];
  let rawCuisine: string[] = [];
  let rawKeywords: string[] = [];
  
  // Try to get from JSON-LD
  try {
    const scriptTags = $('script[type="application/ld+json"]');
    for (let i = 0; i < scriptTags.length; i++) {
      const scriptContent = $(scriptTags[i]).html();
      if (!scriptContent) continue;
      
      const jsonData = JSON.parse(scriptContent);
      let recipes = Array.isArray(jsonData) ? jsonData : [jsonData];
      if (jsonData['@graph']) {
        recipes = jsonData['@graph'];
      }
      
      for (const data of recipes) {
        const isRecipe = isJsonLdRecipeType(data['@type']);
        
        if (isRecipe) {
          if (data.recipeCategory) {
            rawCategory = parseStringArray(data.recipeCategory);
            if (rawCategory.length > 0) {
              console.log('  Found category in JSON-LD:', rawCategory);
            }
          }
          if (data.recipeCuisine) {
            rawCuisine = parseStringArray(data.recipeCuisine);
            if (rawCuisine.length > 0) {
              console.log('  Found cuisine in JSON-LD:', rawCuisine);
            }
          }
          if (data.keywords) {
            rawKeywords = parseKeywords(data.keywords);
            console.log('  Found keywords in JSON-LD:', rawKeywords.length);
          }
          break;
        }
      }
    }
  } catch (error) {
    console.log('  Error extracting metadata from JSON-LD:', error);
  }
  
  // Normalize metadata
  const normalized = normalizeMetadata(rawCategory, rawCuisine, rawKeywords);
  if (normalized.category.length > 0) {
    recipe.category = normalized.category;
    console.log('  ✓ Category:', normalized.category.join(', '));
  }
  if (normalized.cuisine.length > 0) {
    recipe.cuisine = normalized.cuisine;
    console.log('  ✓ Cuisine:', normalized.cuisine.join(', '));
  }
  if (normalized.keywords.length > 0) {
    recipe.keywords = normalized.keywords;
    console.log('  ✓ Keywords:', normalized.keywords.slice(0, 5).join(', ') + (normalized.keywords.length > 5 ? '...' : ''));
  }

  return recipe;
}

/**
 * Helper function to parse a single WPRM ingredient element
 */
function parseWPRMIngredient($: cheerio.CheerioAPI, elem: any, section?: string): Ingredient | null {
  const $elem = $(elem);
  const amount = $elem.find('.wprm-recipe-ingredient-amount').text().trim();
  const unit = $elem.find('.wprm-recipe-ingredient-unit').text().trim();
  const name = $elem.find('.wprm-recipe-ingredient-name').text().trim();
  const notes = $elem.find('.wprm-recipe-ingredient-notes').text().trim();

  // Build original text
  const parts = [amount, unit, name, notes].filter(p => p);
  const originalText = parts.join(' ');

  if (!originalText) {
    return null;
  }

  // Parse amount (handle fractions, decimals, ranges)
  let parsedAmount: number | null = null;
  let parsedAmountMax: number | null = null;
  
  if (amount) {
    // Use parseFloat for WPRM (which provides clean decimal numbers)
    const parsed = parseAmountWithRange(amount, (str) => parseFloat(str) || null);
    parsedAmount = parsed.amount;
    parsedAmountMax = parsed.amountMax || null;
  }

  const normalizedUnit = normalizeUnitText(unit);
  
  if (process.env.DEBUG_INGREDIENT_PARSING === 'true' && unit) {
    console.log(`[wprm-parse] Unit "${unit}" → normalized:`, normalizedUnit);
  }

  return {
    amount: parsedAmount,
    amountMax: parsedAmountMax,
    unit: normalizedUnit,
    name: name || originalText,
    section: section,
    originalText: originalText,
  };
}

function extractFromWPRM($: cheerio.CheerioAPI): ScrapedRecipe | null {
  // Check if this is a WPRM site
  const wprmContainer = $('.wprm-recipe');
  if (!wprmContainer.length) {
    return null;
  }

  // Extract title
  const title = wprmContainer.find('.wprm-recipe-name').text().trim() || 'Untitled Recipe';

  // Extract ingredients with WPRM structure (with section support)
  const ingredients: Ingredient[] = [];
  
  // Check if there are ingredient groups
  const ingredientGroups = wprmContainer.find('.wprm-recipe-ingredient-group');
  
  if (ingredientGroups.length > 0) {
    // Has groups/sections
    ingredientGroups.each((_, group) => {
      const $group = $(group);
      const section = $group.find('.wprm-recipe-ingredient-group-name').text().trim() || undefined;
      
      $group.find('.wprm-recipe-ingredient').each((_, elem) => {
        const ingredient = parseWPRMIngredient($, elem, section);
        if (ingredient) {
          ingredients.push(ingredient);
        }
      });
    });
  } else {
    // No groups, just flat list
    wprmContainer.find('.wprm-recipe-ingredient').each((_, elem) => {
      const ingredient = parseWPRMIngredient($, elem);
      if (ingredient) {
        ingredients.push(ingredient);
      }
    });
  }

  // Extract instructions
  const instructions: string[] = [];
  wprmContainer.find('.wprm-recipe-instruction-text').each((_, elem) => {
    const text = $(elem).text().trim();
    if (text) {
      instructions.push(cleanListItemText(text));
    }
  });

  // Build recipe object (use structured ingredients directly from WPRM)
  const recipe: ScrapedRecipe = {
    title,
    ingredients: ingredients, // Already structured, no need to parse
    instructions,
  };

  // Extract optional fields
  const description = wprmContainer.find('.wprm-recipe-summary').text().trim();
  if (description) {
    recipe.description = description;
  }

  const imageUrl = 
    wprmContainer.find('.wprm-recipe-image img').attr('data-lazy-src') ||
    wprmContainer.find('.wprm-recipe-image img').attr('data-src') ||
    wprmContainer.find('.wprm-recipe-image img').attr('src');
  if (imageUrl) {
    recipe.imageUrl = imageUrl;
  }

  // Extract servings, prepTime, cookTime from WPRM fields
  const servingsText = wprmContainer.find('.wprm-recipe-servings').text().trim();
  if (servingsText) {
    const servings = parseInt(servingsText);
    if (!isNaN(servings)) {
      recipe.servings = servings;
    }
  }

  const prepTimeText = wprmContainer.find('.wprm-recipe-prep_time-minutes').text().trim();
  if (prepTimeText) {
    const prepTime = parseInt(prepTimeText);
    if (!isNaN(prepTime)) {
      recipe.prepTime = prepTime;
    }
  }

  const cookTimeText = wprmContainer.find('.wprm-recipe-cook_time-minutes').text().trim();
  if (cookTimeText) {
    const cookTime = parseInt(cookTimeText);
    if (!isNaN(cookTime)) {
      recipe.cookTime = cookTime;
    }
  }

  // If we didn't get times from WPRM, try JSON-LD as fallback
  if (!recipe.servings || !recipe.prepTime || !recipe.cookTime) {
    console.log('\n--- Supplementary data from JSON-LD (WPRM fallback) ---');
    try {
      const scriptTags = $('script[type="application/ld+json"]');
      console.log(`Found ${scriptTags.length} JSON-LD script tags`);
      
      for (let i = 0; i < scriptTags.length; i++) {
        const scriptContent = $(scriptTags[i]).html();
        if (!scriptContent) continue;
        
        const jsonData = JSON.parse(scriptContent);
        let recipes = Array.isArray(jsonData) ? jsonData : [jsonData];
        if (jsonData['@graph']) {
          recipes = jsonData['@graph'];
        }
        
        for (const data of recipes) {
          const isRecipe = isJsonLdRecipeType(data['@type']);
          
          if (isRecipe) {
            console.log('Found Recipe in JSON-LD');
            console.log('  recipeYield:', data.recipeYield);
            console.log('  prepTime:', data.prepTime);
            console.log('  cookTime:', data.cookTime);
            
            if (data.recipeYield && !recipe.servings) {
              const servings = parseInt(String(data.recipeYield));
              if (!isNaN(servings)) {
                recipe.servings = servings;
                console.log('  ✓ Extracted servings:', servings);
              }
            }
            
            if (data.prepTime && !recipe.prepTime) {
              const prepTime = parseDuration(data.prepTime);
              if (prepTime) {
                recipe.prepTime = prepTime;
                console.log('  ✓ Extracted prepTime:', prepTime, 'minutes');
              }
            }
            
            if (data.cookTime && !recipe.cookTime) {
              const cookTime = parseDuration(data.cookTime);
              if (cookTime) {
                recipe.cookTime = cookTime;
                console.log('  ✓ Extracted cookTime:', cookTime, 'minutes');
              }
            }
            
            break;
          }
        }
      }
    } catch (error) {
      console.log('Error extracting supplementary data from JSON-LD:', error);
    }
  }

  // Extract and normalize metadata (category, cuisine, keywords)
  // WPRM sites typically have this in JSON-LD, not in WPRM HTML
  console.log('\n--- Extracting metadata (category, cuisine, keywords) ---');
  let rawCategory: string[] = [];
  let rawCuisine: string[] = [];
  let rawKeywords: string[] = [];
  
  try {
    const scriptTags = $('script[type="application/ld+json"]');
    for (let i = 0; i < scriptTags.length; i++) {
      const scriptContent = $(scriptTags[i]).html();
      if (!scriptContent) continue;
      
      const jsonData = JSON.parse(scriptContent);
      let recipes = Array.isArray(jsonData) ? jsonData : [jsonData];
      if (jsonData['@graph']) {
        recipes = jsonData['@graph'];
      }
      
      for (const data of recipes) {
        const isRecipe = isJsonLdRecipeType(data['@type']);
        
        if (isRecipe) {
          if (data.recipeCategory) {
            rawCategory = parseStringArray(data.recipeCategory);
            if (rawCategory.length > 0) {
              console.log('  Found category in JSON-LD:', rawCategory);
            }
          }
          if (data.recipeCuisine) {
            rawCuisine = parseStringArray(data.recipeCuisine);
            if (rawCuisine.length > 0) {
              console.log('  Found cuisine in JSON-LD:', rawCuisine);
            }
          }
          if (data.keywords) {
            rawKeywords = parseKeywords(data.keywords);
            console.log('  Found keywords in JSON-LD:', rawKeywords.length);
          }
          break;
        }
      }
    }
  } catch (error) {
    console.log('  Error extracting metadata from JSON-LD:', error);
  }
  
  // Normalize metadata
  const normalized = normalizeMetadata(rawCategory, rawCuisine, rawKeywords);
  if (normalized.category.length > 0) {
    recipe.category = normalized.category;
    console.log('  ✓ Category:', normalized.category.join(', '));
  }
  if (normalized.cuisine.length > 0) {
    recipe.cuisine = normalized.cuisine;
    console.log('  ✓ Cuisine:', normalized.cuisine.join(', '));
  }
  if (normalized.keywords.length > 0) {
    recipe.keywords = normalized.keywords;
    console.log('  ✓ Keywords:', normalized.keywords.slice(0, 5).join(', ') + (normalized.keywords.length > 5 ? '...' : ''));
  }

  return recipe;
}

function parseIngredientList(ingredients: any[]): Ingredient[] {
  return ingredients.map((item) => {
    // Handle PropertyValue format from JSON-LD
    if (typeof item === 'object' && item['@type'] === 'PropertyValue') {
      const value = item.value ? String(item.value) : '';
      const name = item.name || '';
      const unitCode = item.unitCode || '';
      
      // Build text representation
      const parts = [value, unitCode, name].filter(p => p);
      const text = parts.join(' ');
      
      const amount = value ? parseFraction(String(value)) : null;
      const unit = normalizeUnitText(unitCode);
      const nameValue = name || text;
      const baseConfidence = scoreIngredientParse({
        hasAmount: amount !== null,
        hasUnit: unit !== null,
        normalizedBySize: false,
        hadAmountMatch: amount !== null,
        hasName: !!nameValue,
      });
      return {
        amount,
        unit,
        name: nameValue,
        originalText: text,
        parseConfidence: applyConfidencePenalties(baseConfidence, {
          hasMultipleNames: false,
          hasFromClause: /\bfrom\b/i.test(text),
        }),
      };
    }
    
    // Handle plain text format
    return parseIngredient(String(item));
  });
}

function cleanListItemText(text: string): string {
  let cleaned = text.trim();
  
  // Remove list markers and bullets from the front, but preserve ingredient amounts
  // Only strip numbers if followed by punctuation (e.g., "1.", "2)", "1-")
  // This preserves ingredient amounts like "1 yellow onion"
  
  // Strip numbered list markers: "1.", "2)", "3-", etc.
  cleaned = cleaned.replace(/^\d+[\.\)\-:]\s*/, '');
  
  // Strip bullets, checkboxes, and other Unicode symbols
  // \u2022-\u2026 - bullets (•, ‣, ◦, …, etc.)
  // \u2610-\u2612 - checkboxes (☐, ☑, ☒)
  // \u2713-\u2714 - check marks (✓, ✔)
  // \u25AA-\u25AB - squares (▪, ▫)
  // \u25CB-\u25CF - circles (○, ●)
  // \u25E6 - white bullet (◦)
  cleaned = cleaned.replace(/^[\u2022-\u2026\u2610-\u2612\u2713-\u2714\u25AA-\u25AB\u25CB-\u25CF\u25E6]+\s*/, '');
  
  // Strip other common list markers (-, *, +, etc.) only if at the start
  cleaned = cleaned.replace(/^[\-\*\+]\s+/, '');
  
  return cleaned.trim();
}

function parseFraction(str: string): number | null {
  if (!str) return null;
  
  // Handle fractions like "1/2"
  if (str.includes('/')) {
    const [num, denom] = str.split('/').map(s => parseFloat(s.trim()));
    if (!isNaN(num) && !isNaN(denom) && denom !== 0) {
      return num / denom;
    }
  }
  
  // Handle decimals and whole numbers
  const parsed = parseFloat(str);
  return isNaN(parsed) ? null : parsed;
}

function scoreIngredientParse(params: {
  hasAmount: boolean;
  hasUnit: boolean;
  normalizedBySize: boolean;
  hadAmountMatch: boolean;
  hasName: boolean;
}): number {
  let score: number;
  if (params.normalizedBySize) {
    score = 0.9;
  } else if (params.hasAmount && params.hasUnit) {
    score = 0.85;
  } else if (params.hasAmount) {
    score = 0.6;
  } else if (params.hasUnit) {
    score = 0.4;
  } else {
    score = 0.25;
  }

  if (!params.hadAmountMatch) {
    score = Math.min(score, 0.35);
  }
  if (!params.hasName) {
    score = Math.min(score, 0.2);
  }
  return Math.max(0, Math.min(1, score));
}

function applyConfidencePenalties(
  score: number,
  flags: { hasMultipleNames: boolean; hasFromClause: boolean }
): number {
  let adjusted = score;
  if (flags.hasMultipleNames) {
    adjusted = Math.min(adjusted, 0.4);
  }
  if (flags.hasFromClause) {
    adjusted = Math.min(adjusted, 0.5);
  }
  return adjusted;
}

const DEBUG_INGREDIENT_PARSING = process.env.DEBUG_INGREDIENT_PARSING === 'true';

function logIngredientParse(label: string, data: Record<string, unknown>): void {
  if (!DEBUG_INGREDIENT_PARSING) return;
  console.log(`[ingredient-parse] ${label}:`, JSON.stringify(data));
}

/**
 * Normalize a unit string to its canonical form
 * E.g., "lbs" → "pound", "tbsp" → "tablespoon"
 * Useful for aggregating ingredients with different unit spellings
 */
function normalizeUnitText(unit: string | null): UnitValue | null {
  if (!unit) return null;
  const trimmed = unit.trim();
  if (!trimmed) return null;

  const normalizedValue = trimmed.toUpperCase();
  if ((Object.values(UnitValue) as string[]).includes(normalizedValue)) {
    return normalizedValue as UnitValue;
  }

  for (const [unitValue, patterns] of Object.entries(UNIT_ALIAS_PATTERNS)) {
    for (const pattern of patterns) {
      const regex = new RegExp(`^(${pattern})$`, 'i');
      if (regex.test(trimmed)) {
        return unitValue as UnitValue;
      }
    }
  }

  return null;
}

function matchUnitFromStart(text: string): { unit: UnitValue; match: string } | null {
  for (const matcher of UNIT_ALIAS_MATCHERS) {
    const match = text.match(matcher.regex);
    if (match) {
      return { unit: matcher.unit, match: match[0] };
    }
  }
  return null;
}

// Matches a size spec after an initial count (e.g., "15 oz", "8.8-oz", "(12 ounce)"):
// 1) size amount (supports fractions/mixed/decimals), 2) size unit words (e.g., "oz", "fl oz"),
// 3) remainder (ingredient name, optional container word).
const SIZE_SPEC_REGEX = /^\(?(\d+(?:\s+\d+\/\d+|\/\d+|\.\d+)?)(?:\s*-\s*|\s*)([a-zA-Z]+\.?(?:\s*[a-zA-Z]+\.?)?)\)?\s*(.*)$/;
const CONTAINER_WORD_PATTERNS = [
  'can(s)?',
  'package(s)?',
  'pkg(s)?',
  'jar(s)?',
  'bag(s)?',
  'bottle(s)?',
  'box(es)?',
  'slice(s)?',
  'tin(s)?',
];

// Normalize "count + size + unit" patterns (e.g., "2 8.8-oz packages beets")
// into total amount + unit, stripping container words from the name.
function extractSizedAmount(
  count: number,
  rest: string
): { amount: number; unit: UnitValue; name: string } | null {
  const trimmed = rest.trim();
  const sizeMatch = trimmed.match(SIZE_SPEC_REGEX);
  if (!sizeMatch) return null;

  const sizeAmountStr = sizeMatch[1];
  let sizeUnitText = sizeMatch[2].replace(/\s+/g, ' ').trim();
  let remainder = (sizeMatch[3] || '').trim();

  const sizeAmount = parseSingleAmount(sizeAmountStr);
  let sizeUnit = normalizeUnitText(sizeUnitText);
  if (!sizeUnit && sizeUnitText.includes(' ')) {
    const tokens = sizeUnitText.split(' ');
    for (let i = 1; i <= tokens.length; i++) {
      const candidate = tokens.slice(0, i).join(' ');
      const candidateUnit = normalizeUnitText(candidate);
      if (candidateUnit) {
        sizeUnit = candidateUnit;
        const leftover = tokens.slice(i).join(' ').trim();
        remainder = `${leftover} ${remainder}`.trim();
        sizeUnitText = candidate;
        break;
      }
    }
  }
  if (sizeAmount === null || !sizeUnit) return null;

  if (remainder) {
    const containerRegex = new RegExp(`^(${CONTAINER_WORD_PATTERNS.join('|')})\\b\\.?\\s*`, 'i');
    remainder = remainder.replace(containerRegex, '');
    remainder = remainder.replace(/^of\b\s*/i, '');
    remainder = remainder.replace(/^[\s,.-]+/, '').trim();
  }

  if (!remainder) return null;

  return {
    amount: count * sizeAmount,
    unit: sizeUnit,
    name: remainder,
  };
}

function parseIngredientText(text: string): Ingredient {
  const cleaned = cleanListItemText(text);
  const normalized = normalizeFractions(cleaned);
  const hasFromClause = /\bfrom\b/i.test(cleaned);

  logIngredientParse('input', { text, cleaned, normalized });
  
  // Try to parse: [amount] [unit] [name]
  // Regex explanation:
  // - (\d+(?:[\/\.\-]\d+)?(?:\s*-\s*\d+(?:[\/\.\-]\d+)?)?) - amount with optional fraction/decimal/range
  // - \s+ - whitespace
  // - ([\w\s\.]+?) - unit (optional, non-greedy)
  // - \s+ - whitespace
  // - (.+) - everything else is the name
  
  // First, try to match amount at the start
  const amountMatch = normalized.match(/^(\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?(?:\s*-\s*\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?)?)\s+(.+)$/);
  
  if (!amountMatch) {
    // No amount found, return as-is
    const result = {
      amount: null,
      unit: null,
      name: cleaned,
      originalText: cleaned,
      parseConfidence: applyConfidencePenalties(scoreIngredientParse({
        hasAmount: false,
        hasUnit: false,
        normalizedBySize: false,
        hadAmountMatch: false,
        hasName: !!cleaned,
      }), {
        hasMultipleNames: false,
        hasFromClause,
      }),
    };
    logIngredientParse('no-amount', result);
    return result;
  }
  
  const amountStr = amountMatch[1];
  const rest = amountMatch[2];
  
  // Parse amount (handle ranges like "1-2" and mixed fractions like "1 1/2")
  const parsed = parseAmountWithRange(amountStr);
  let amount = parsed.amount;
  let amountMax = parsed.amountMax || null;
  
  // If rest starts with a size spec (e.g., "15 oz. can"), normalize to total size
  if (amount !== null && !amountMax) {
    const sized = extractSizedAmount(amount, rest);
    if (sized) {
      return {
        amount: sized.amount,
        unit: sized.unit,
        name: sized.name,
        originalText: cleaned,
        parseConfidence: applyConfidencePenalties(scoreIngredientParse({
          hasAmount: true,
          hasUnit: true,
          normalizedBySize: true,
          hadAmountMatch: true,
          hasName: !!sized.name,
        }), {
          hasMultipleNames: false,
          hasFromClause,
        }),
      };
    }
  }

  // Try to find a unit at the start of the rest
  let unit: UnitValue | null = null;
  let name = rest;
  let unitSource = rest;

  const sizePrefixMatch = rest.match(/^(small|medium|large)\b\s+/i);
  if (sizePrefixMatch) {
    unitSource = rest.substring(sizePrefixMatch[0].length);
  }

  const unitMatch = matchUnitFromStart(unitSource);
  if (unitMatch) {
    unit = unitMatch.unit;
    name = unitSource.substring(unitMatch.match.length).trim();
  }
  
  const result = {
    amount,
    amountMax: amountMax || undefined,
    unit,
    name: name || cleaned,
    originalText: cleaned,
    parseConfidence: applyConfidencePenalties(scoreIngredientParse({
      hasAmount: amount !== null,
      hasUnit: unit !== null,
      normalizedBySize: false,
      hadAmountMatch: true,
      hasName: !!(name || cleaned),
    }), {
      hasMultipleNames: false,
      hasFromClause,
    }),
  };
  logIngredientParse('parsed', {
    amountStr,
    rest,
    unitMatch: unitMatch ? { unit: unitMatch.unit, match: unitMatch.match } : null,
    result,
  });
  return result;
}

function parseIngredient(text: string): Ingredient {
  // Use the new text parser
  return parseIngredientText(text);
}

export function parseIngredientTextForApi(text: string): Ingredient {
  return parseIngredient(text);
}

function parseInstructions(instructions: any[]): string[] {
  if (!Array.isArray(instructions)) {
    return [cleanListItemText(String(instructions))];
  }

  return instructions.map((instruction) => {
    let text = '';
    if (typeof instruction === 'string') {
      text = instruction;
    } else if (instruction.text) {
      text = instruction.text;
    } else if (instruction['@type'] === 'HowToStep' && instruction.text) {
      text = instruction.text;
    } else {
      text = String(instruction);
    }
    return cleanListItemText(text);
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

/**
 * Parse duration from natural language text
 * E.g., "15 min", "1 hour 30 minutes", "45 mins", "1 hr 15 min"
 */
function parseDurationFromText(text: string): number | undefined {
  if (!text) return undefined;
  
  const normalized = text.toLowerCase();
  let totalMinutes = 0;
  
  // Match hours: "1 hour", "2 hrs", "1 h"
  const hourMatch = normalized.match(/(\d+)\s*(?:hour|hours|hr|hrs|h)\b/);
  if (hourMatch) {
    totalMinutes += parseInt(hourMatch[1]) * 60;
  }
  
  // Match minutes: "30 minutes", "45 mins", "15 min", "20 m"
  const minMatch = normalized.match(/(\d+)\s*(?:minute|minutes|mins|min|m)\b/);
  if (minMatch) {
    totalMinutes += parseInt(minMatch[1]);
  }
  
  return totalMinutes > 0 ? totalMinutes : undefined;
}

/**
 * Extract servings from text
 * E.g., "Serves 4", "Yield: 6 servings", "Makes 8", "4 servings"
 */
function parseServingsFromText(text: string): number | undefined {
  if (!text) return undefined;
  
  const normalized = text.toLowerCase();
  
  // Try patterns: "serves 4", "yield: 6", "makes 8", "4 servings"
  const patterns = [
    /serves?\s*:?\s*(\d+)/,
    /yield\s*:?\s*(\d+)/,
    /makes?\s*:?\s*(\d+)/,
    /(\d+)\s*servings?/,
  ];
  
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const num = parseInt(match[1]);
      if (num > 0 && num < 100) { // Reasonable serving size
        return num;
      }
    }
  }
  
  return undefined;
}

/**
 * Try to extract servings, prepTime, and cookTime from generic HTML
 * Uses common selectors and text patterns
 */
function extractMetadataFromHTML($: cheerio.CheerioAPI): {
  servings?: number;
  prepTime?: number;
  cookTime?: number;
} {
  const result: { servings?: number; prepTime?: number; cookTime?: number } = {};
  
  // Common selectors for recipe metadata
  const metaSelectors = [
    '[class*="recipe-meta"]',
    '[class*="recipe-info"]',
    '[class*="recipe-details"]',
    '[class*="meta"]',
    '.recipe-yield',
    '.yield',
    '.servings',
    '.prep-time',
    '.cook-time',
  ];
  
  // Search through common metadata areas
  metaSelectors.forEach(selector => {
    $(selector).each((_, elem) => {
      const text = $(elem).text();
      
      // Try to extract servings
      if (!result.servings) {
        result.servings = parseServingsFromText(text);
      }
      
      // Try to extract prep time
      if (!result.prepTime && /prep/i.test(text)) {
        result.prepTime = parseDurationFromText(text);
      }
      
      // Try to extract cook time
      if (!result.cookTime && /cook/i.test(text)) {
        result.cookTime = parseDurationFromText(text);
      }
    });
  });
  
  // Also check meta tags
  if (!result.servings) {
    const yieldMeta = $('meta[name*="yield"], meta[property*="yield"]').attr('content');
    if (yieldMeta) {
      result.servings = parseServingsFromText(yieldMeta);
    }
  }
  
  return result;
}

