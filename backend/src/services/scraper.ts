import * as cheerio from 'cheerio';
import { Ingredient, RecipeContent, ExtractionMethod } from '../types/index.js';

// ScrapedRecipe extends RecipeContent with extraction metadata
interface ScrapedRecipe extends RecipeContent {
  extractionMethod?: ExtractionMethod;
}

// Unit synonyms: normalized unit → array of variations
// The key is the canonical/normalized form, values are ONLY the synonyms (not including the key)
// Empty array means no synonyms exist
// This enables unit normalization for shopping list aggregation:
//   e.g., "1 lb carrots" + "2 pounds carrots" → both use "pound" unit
const UNIT_SYNONYMS: Record<string, string[]> = {
  // Volume
  'cup': ['cups', 'c'],
  'tablespoon': ['tablespoons', 'tbsp', 'tbs', 'T'],
  'teaspoon': ['teaspoons', 'tsp', 't'],
  'fluid ounce': ['fluid ounces', 'fl oz', 'fl. oz.'],
  'milliliter': ['milliliters', 'ml', 'mL'],
  'liter': ['liters', 'l', 'L'],
  'pint': ['pints', 'pt'],
  'quart': ['quarts', 'qt'],
  'gallon': ['gallons', 'gal'],
  // Weight
  'pound': ['pounds', 'lb', 'lbs'],
  'ounce': ['ounces', 'oz'],
  'gram': ['grams', 'g'],
  'kilogram': ['kilograms', 'kg'],
  // Count/Pieces
  'piece': ['pieces', 'pc'],
  'whole': ['wholes'],
  'clove': ['cloves'],
  'slice': ['slices'],
  'can': ['cans'],
  'package': ['packages', 'pkg'],
  'jar': ['jars'],
  'bunch': ['bunches'],
  'head': ['heads'],
  'stalk': ['stalks'],
  'sprig': ['sprigs'],
  'leaf': ['leaves'],
  // Special
  'pinch': ['pinches'],
  'dash': ['dashes'],
  'handful': ['handfuls'],
  'to taste': [],
};

// Flatten to list for matching, and build reverse lookup map
// Include both canonical forms and their synonyms
const COMMON_UNITS = [
  ...Object.keys(UNIT_SYNONYMS),
  ...Object.values(UNIT_SYNONYMS).flat()
];

const UNIT_NORMALIZATION_MAP: Record<string, string> = {};
for (const [normalized, synonyms] of Object.entries(UNIT_SYNONYMS)) {
  // Map canonical form to itself
  UNIT_NORMALIZATION_MAP[normalized.toLowerCase()] = normalized;
  // Map each synonym to the canonical form
  for (const synonym of synonyms) {
    UNIT_NORMALIZATION_MAP[synonym.toLowerCase()] = normalized;
  }
}

/**
 * Normalize Unicode fractions to ASCII format using NFKD normalization
 * E.g., "¼" → "1/4", "½" → "1/2"
 *
 * NFKD decomposition turns "¼" into "1⁄4" (using the special fraction slash U+2044)
 * We then replace the special Unicode fraction slash with an ASCII forward slash
 */
function normalizeFractions(input: string): string {
  // 1. Decompose characters using NFKD normalization
  // This turns "¼" into "1⁄4" (using the special fraction slash U+2044)
  const decomposed = input.normalize("NFKD");

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
  console.log('Ingredients count:', recipe.ingredients.length);
  console.log('Sample ingredients:');
  recipe.ingredients.slice(0, 3).forEach((ing, i) => {
    console.log(`  [${i}]`, JSON.stringify(ing, null, 2));
  });
  console.log('Instructions count:', recipe.instructions.length);
}

/**
 * Scrape recipe from HTML content (useful for testing with fixtures)
 */
export async function scrapeRecipeFromHTML(html: string, url: string): Promise<ScrapedRecipe> {
  try {
    const $ = cheerio.load(html);

    // Detect recipe plugins/formats
    console.log('\n=== RECIPE PLUGIN DETECTION ===');
    console.log('WPRM (WP EditRecipe Maker):', !!$('.wprm-recipe').length);
    console.log('Tasty Recipes:', !!$('.tasty-recipes').length);
    console.log('WP EditRecipe Card:', !!$('.wp-block-recipe-card').length);
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
      logRecipeSample(wprmRecipe);
      console.log('\n✅ Using WPRM extraction');
      wprmRecipe.extractionMethod = 'WPRM';
      return wprmRecipe;
    }
    console.log('✗ WPRM not detected');

    // Priority 2: Data attributes (fully structured)
    console.log('\n--- Trying data attribute extraction ---');
    const dataAttrRecipe = extractFromDataAttributes($);
    if (dataAttrRecipe && dataAttrRecipe.ingredients.length > 0) {
      console.log('✓ Data attribute extraction successful');
      logRecipeSample(dataAttrRecipe);
      console.log('\n✅ Using data attribute extraction');
      dataAttrRecipe.extractionMethod = 'DataAttributes';
      return dataAttrRecipe;
    }
    console.log('✗ Data attributes not found');

    // Priority 3: JSON-LD (good metadata, text parsing for ingredients)
    console.log('\n--- Trying JSON-LD extraction ---');
    const jsonLdRecipe = extractFromJsonLd($);
    if (jsonLdRecipe) {
      console.log('✓ JSON-LD extraction successful');
      logRecipeSample(jsonLdRecipe);
      console.log('\n✅ Using JSON-LD extraction (with text parsing)');
      jsonLdRecipe.extractionMethod = 'JSON-LD';
      return jsonLdRecipe;
    }
    console.log('✗ JSON-LD not found');

    // Priority 4: Generic HTML (fallback, text parsing)
    console.log('\n--- Falling back to generic HTML extraction ---');
    const htmlRecipe = extractFromHtml($, url);
    console.log('✓ HTML extraction complete');
    logRecipeSample(htmlRecipe);
    console.log('\n✅ Using HTML extraction (with text parsing)');
    htmlRecipe.extractionMethod = 'HTML';

    console.log('\n========================================\n');
    return htmlRecipe;
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
export async function scrapeRecipe(url: string): Promise<ScrapedRecipe> {
  const html = await fetchHTML(url);
  try {
    return await scrapeRecipeFromHTML(html, url);
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
        const typeArray = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
        const isRecipe = typeArray.includes('Recipe');

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
            title: data.name || 'Untitled EditRecipe',
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
    'Untitled EditRecipe';

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
        const typeArray = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
        const isRecipe = typeArray.includes('Recipe');

        if (isRecipe) {
          console.log('Found EditRecipe in JSON-LD');
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
    'Untitled EditRecipe';

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

      ingredients.push({
        amount: parsedAmount,
        amountMax: parsedAmountMax || undefined,
        unit: unit || null,
        name: name,
        section: section,
        originalText: originalText,
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

  const imageUrl = $('meta[property="og:image"]').attr('content') || $('img[class*="recipe"]').first().attr('src');
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
        const typeArray = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
        const isRecipe = typeArray.includes('Recipe');

        if (isRecipe) {
          console.log('✓ Found EditRecipe in JSON-LD');
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

  return {
    amount: parsedAmount,
    amountMax: parsedAmountMax,
    unit: unit || null,
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
  const title = wprmContainer.find('.wprm-recipe-name').text().trim() || 'Untitled EditRecipe';

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

  const imageUrl = wprmContainer.find('.wprm-recipe-image img').attr('src');
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
          const typeArray = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
          const isRecipe = typeArray.includes('Recipe');

          if (isRecipe) {
            console.log('Found EditRecipe in JSON-LD');
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

      return {
        amount: value ? parseFraction(String(value)) : null,
        unit: unitCode || null,
        name: name || text,
        originalText: text,
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

/**
 * Normalize a unit string to its canonical form
 * E.g., "lbs" → "pound", "tbsp" → "tablespoon"
 * Useful for aggregating ingredients with different unit spellings
 */
function normalizeUnit(unit: string | null): string | null {
  if (!unit) return null;
  return UNIT_NORMALIZATION_MAP[unit.toLowerCase()] || unit;
}

function parseIngredientText(text: string): Ingredient {
  const cleaned = cleanListItemText(text);
  const normalized = normalizeFractions(cleaned);

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
    return {
      amount: null,
      unit: null,
      name: cleaned,
      originalText: cleaned,
    };
  }

  const amountStr = amountMatch[1];
  const rest = amountMatch[2];

  // Parse amount (handle ranges like "1-2" and mixed fractions like "1 1/2")
  const parsed = parseAmountWithRange(amountStr);
  let amount = parsed.amount;
  let amountMax = parsed.amountMax || null;

  // Try to find a unit at the start of the rest
  let unit: string | null = null;
  let name = rest;

  for (const possibleUnit of COMMON_UNITS) {
    const unitRegex = new RegExp(`^(${possibleUnit})\\b`, 'i');
    const unitMatch = rest.match(unitRegex);
    if (unitMatch) {
      const matchedUnit = unitMatch[1];
      // Normalize the unit (e.g., "lb" → "pound", "tbsp" → "tablespoon")
      unit = UNIT_NORMALIZATION_MAP[matchedUnit.toLowerCase()] || matchedUnit;
      name = rest.substring(matchedUnit.length).trim();
      break;
    }
  }

  return {
    amount,
    amountMax: amountMax || undefined,
    unit,
    name: name || cleaned,
    originalText: cleaned,
  };
}

function parseIngredient(text: string): Ingredient {
  // Use the new text parser
  return parseIngredientText(text);
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
