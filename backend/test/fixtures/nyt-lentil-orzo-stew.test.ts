/**
 * Test: NYT Cooking - Lentil and Orzo Stew
 * URL: https://cooking.nytimes.com/recipes/1021261-lentil-and-orzo-stew-with-roasted-eggplant
 * Fixture: nyt-lentil-orzo-stew.html
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scrapeRecipeFromHTML } from '../../src/services/scraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_FILE = 'nyt-lentil-orzo-stew.html';
const EXPECTED_METHOD = 'JSON-LD'; // Expected: WPRM | DataAttributes | JSON-LD | HTML

function loadFixture(): string {
  const filepath = join(__dirname, FIXTURE_FILE);
  return readFileSync(filepath, 'utf-8');
}

async function runTest() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing: ${FIXTURE_FILE}`);
  console.log(`${'='.repeat(70)}\n`);

  const html = loadFixture();
  const recipe = await scrapeRecipeFromHTML(html, `https://cooking.nytimes.com/recipes/1021261-lentil-and-orzo-stew-with-roasted-eggplant`);

  console.log('\n📊 RESULTS:\n');
  console.log(`Title: ${recipe.title}`);
  console.log(`Extraction Method: ${recipe.extractionMethod || 'unknown'}`);
  console.log(`Ingredients: ${recipe.ingredients.length}`);
  console.log(`Instructions: ${recipe.instructions.length}`);

  // Sample ingredients for verification
  console.log('\n🥕 SAMPLE INGREDIENTS:\n');
  recipe.ingredients.slice(0, 5).forEach((ing, i) => {
    console.log(`${i + 1}. ${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim());
    if (ing.section) console.log(`   Section: "${ing.section}"`);
  });

  // Validation
  console.log('\n✓ VALIDATION:\n');
  const validations = [
    { check: recipe.title?.length > 0, message: 'Has title' },
    { check: recipe.ingredients.length > 0, message: 'Has ingredients' },
    { check: recipe.instructions.length > 0, message: 'Has instructions' },
    { check: recipe.extractionMethod === EXPECTED_METHOD, message: `Extraction method is ${EXPECTED_METHOD}` },
  ];

  validations.forEach(({ check, message }) => {
    console.log(`  ${check ? '✓' : '✗'} ${message}`);
  });

  const allPassed = validations.every(v => v.check);
  console.log(`\n${allPassed ? '✅ TEST PASSED' : '❌ TEST FAILED'}\n`);

  process.exit(allPassed ? 0 : 1);
}

runTest().catch((error) => {
  console.error('\n❌ TEST ERROR:', error);
  process.exit(1);
});

