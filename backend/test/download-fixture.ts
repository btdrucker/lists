#!/usr/bin/env tsx
/**
 * Helper script to download HTML from a recipe URL and save it as a test fixture
 * 
 * Usage:
 *   tsx test/download-fixture.ts <url> [output-filename]
 * 
 * Examples:
 *   tsx test/download-fixture.ts https://www.budgetbytes.com/curried-red-lentil-and-pumpkin-soup/
 *   # Saves to: curried-red-lentil-and-pumpkin-soup.html
 * 
 *   tsx test/download-fixture.ts https://example.com/recipe custom-name.html
 *   # Saves to: custom-name.html
 */

import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generate test file content
 */
function generateTestFile(htmlFilename: string, url: string): string {
  return `/**
 * Test: ${htmlFilename.replace('.html', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
 * URL: ${url}
 * Fixture: ${htmlFilename}
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scrapeRecipeFromHTML } from '../../src/services/scraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_FILE = '${htmlFilename}';
const EXPECTED_METHOD = 'JSON-LD'; // Expected: WPRM | DataAttributes | JSON-LD | HTML - UPDATE THIS

function loadFixture(): string {
  const filepath = join(__dirname, FIXTURE_FILE);
  return readFileSync(filepath, 'utf-8');
}

async function runTest() {
  console.log(\`\\n\${'='.repeat(70)}\`);
  console.log(\`Testing: \${FIXTURE_FILE}\`);
  console.log(\`\${'='.repeat(70)}\\n\`);

  const html = loadFixture();
  const recipe = await scrapeRecipeFromHTML(html, \`${url}\`);

  console.log('\\n📊 RESULTS:\\n');
  console.log(\`Title: \${recipe.title}\`);
  console.log(\`Extraction Method: \${recipe.extractionMethod || 'unknown'}\`);
  console.log(\`Ingredients: \${recipe.ingredients.length}\`);
  console.log(\`Instructions: \${recipe.instructions.length}\`);

  // Sample ingredients for verification
  console.log('\\n🥕 SAMPLE INGREDIENTS:\\n');
  recipe.ingredients.slice(0, 5).forEach((ing, i) => {
    console.log(\`\${i + 1}. \${ing.amount || ''} \${ing.unit || ''} \${ing.name}\`.trim());
    if (ing.section) console.log(\`   Section: "\${ing.section}"\`);
  });

  // Validation
  console.log('\\n✓ VALIDATION:\\n');
  const validations = [
    { check: recipe.title?.length > 0, message: 'Has title' },
    { check: recipe.ingredients.length > 0, message: 'Has ingredients' },
    { check: recipe.instructions.length > 0, message: 'Has instructions' },
    { check: recipe.extractionMethod === EXPECTED_METHOD, message: \`Extraction method is \${EXPECTED_METHOD}\` },
  ];

  validations.forEach(({ check, message }) => {
    console.log(\`  \${check ? '✓' : '✗'} \${message}\`);
  });

  const allPassed = validations.every(v => v.check);
  console.log(\`\\n\${allPassed ? '✅ TEST PASSED' : '❌ TEST FAILED'}\\n\`);

  process.exit(allPassed ? 0 : 1);
}

runTest().catch((error) => {
  console.error('\\n❌ TEST ERROR:', error);
  process.exit(1);
});
`;
}

/**
 * Generate filename from URL path
 */
function generateFilename(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Get the last segment of the path
    const segments = pathname.split('/').filter(s => s.length > 0);
    let filename = segments[segments.length - 1] || 'recipe';
    
    // Remove common extensions
    filename = filename.replace(/\.(html?|php|aspx?)$/i, '');
    
    // Add .html if not present
    if (!filename.endsWith('.html')) {
      filename += '.html';
    }
    
    return filename;
  } catch (error) {
    return 'recipe.html';
  }
}

async function downloadFixture(url: string, filename?: string) {
  try {
    // Generate filename from URL if not provided
    const outputFilename = filename || generateFilename(url);
    const filepath = join(__dirname, 'fixtures', outputFilename);
    
    // Check if file already exists
    if (existsSync(filepath)) {
      console.error(`✗ Error: File already exists: ${filepath}`);
      console.error(`\nTo overwrite, either:`);
      console.error(`  1. Delete the existing file first`);
      console.error(`  2. Provide a different filename: tsx test/download-fixture.ts "${url}" custom-name.html`);
      process.exit(1);
    }
    
    console.log(`Downloading: ${url}`);
    console.log(`Saving to: ${outputFilename}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    writeFileSync(filepath, html, 'utf-8');
    console.log(`✓ Saved ${html.length} bytes to: ${filepath}`);
    
    // Generate test file
    const testFilename = outputFilename.replace('.html', '.test.ts');
    const testFilepath = join(__dirname, 'fixtures', testFilename);
    
    if (!existsSync(testFilepath)) {
      const testContent = generateTestFile(outputFilename, url);
      writeFileSync(testFilepath, testContent, 'utf-8');
      console.log(`✓ Generated test file: ${testFilename}`);
    } else {
      console.log(`ℹ Test file already exists: ${testFilename}`);
    }
    
    console.log(`\n📝 Next steps:`);
    console.log(`1. Review and customize: test/fixtures/${testFilename}`);
    console.log(`2. Update EXPECTED_METHOD if needed`);
    console.log(`3. Run: npm test`);
    
  } catch (error) {
    console.error(`✗ Failed to download fixture:`, error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 1 || args.length > 2) {
  console.error(`Usage: tsx test/download-fixture.ts <url> [output-filename]`);
  console.error(`\nExamples:`);
  console.error(`  tsx test/download-fixture.ts https://example.com/recipe/my-recipe/`);
  console.error(`  # Auto-generates: my-recipe.html`);
  console.error(`\n  tsx test/download-fixture.ts https://example.com/recipe custom-name.html`);
  console.error(`  # Saves as: custom-name.html`);
  process.exit(1);
}

const [url, filename] = args;

downloadFixture(url, filename);

