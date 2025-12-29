# Recipe HTML Test Fixtures

This directory contains saved HTML files from real recipe websites for testing the scraper.

## Adding New Fixtures

### Step 1: Download the HTML

**Option A - Using the download script (recommended):**
```bash
cd backend

# Auto-generates filename from URL
npm run download-fixture https://www.budgetbytes.com/some-recipe/
# Creates: some-recipe.html

# Custom filename (if file exists or you want different name)
npm run download-fixture https://example.com/recipe custom-name.html
```

**Option B - Manual download:**
1. Visit the recipe page in your browser
2. View page source (Cmd+Option+U on Mac, Ctrl+U on Windows)
3. Copy all HTML
4. Save it as `[site-name]-[recipe-name].html` in this directory

### Step 2: Add to test suite

Edit `../scraper.test.ts` and add a new fixture object:

```typescript
{
  name: 'Site Name - Recipe Name',
  file: 'site-recipe.html',
  url: 'https://example.com/recipe',
  expectedMethod: 'WPRM' | 'DataAttributes' | 'JSON-LD' | 'HTML',
  expectedSections: ['Section 1', 'Section 2'], // optional
  sampleIngredients: [
    { name: 'flour', amount: 2, unit: 'cups' },
    // ...
  ],
}
```

### Step 3: Run tests

```bash
npm test
```

## Current Fixtures:

### Budget Bytes (WPRM Plugin)
- **File**: `budgetbytes-lentil-pumpkin-soup.html`
- **URL**: https://www.budgetbytes.com/curried-red-lentil-and-pumpkin-soup/
- **Expected**: WPRM extraction with full structure

### AllRecipes (Data Attributes)
- **File**: `allrecipes-vegan-shepherds-pie.html`
- **URL**: https://www.allrecipes.com/recipe/180735/traditional-style-vegan-shepherds-pie/
- **Expected**: Data attribute extraction with sections ("Mashed potato layer", "Bottom layer")

### Serious Eats (Data Attributes)
- **File**: `seriouseats-black-eyed-pea-stew.html`
- **URL**: https://www.seriouseats.com/easy-one-pot-black-eyed-pea-stew-swiss-chard-dill-5199802
- **Expected**: Data attribute extraction

### NYT Cooking (JSON-LD)
- **File**: `nyt-lentil-orzo-stew.html`
- **URL**: https://cooking.nytimes.com/recipes/1021261-lentil-and-orzo-stew-with-roasted-eggplant
- **Expected**: JSON-LD extraction with text parsing

### Bon Appétit (JSON-LD Only)
- **File**: `bonappetit-pierogies-beets.html`
- **URL**: https://www.bonappetit.com/recipe/sheet-pan-pierogies-and-beets
- **Expected**: JSON-LD extraction

## Site Patterns & Extraction Methods

### WPRM Plugin (WordPress Recipe Maker)
**Sites**: Budget Bytes, many WordPress food blogs  
**Selectors**: `.wprm-recipe`, `.wprm-recipe-ingredient-group`  
**Structure**: Fully structured with separate spans for amount/unit/name/notes  
**Sections**: Native support via `.wprm-recipe-ingredient-group-name`

### Data Attributes
**Sites**: AllRecipes, Serious Eats  
**Selectors**: `[data-ingredient-quantity]`, `[data-ingredient-unit]`, `[data-ingredient-name]`  
**Structure**: Fully structured via data attributes  
**Sections**: Detected from headings (`h2`, `h3`, `h4`) before ingredient lists

### JSON-LD
**Sites**: NYT Cooking, Bon Appétit, most modern recipe sites  
**Format**: `<script type="application/ld+json">` with Recipe schema  
**Structure**: Usually plain text, requires text parsing for amount/unit/name  
**Sections**: Usually not present in JSON-LD  
**Note**: May be wrapped in `@graph` array (WordPress pattern)

### Generic HTML Fallback
**Sites**: Any site without above patterns  
**Method**: Searches for common selectors (`.ingredient`, `[itemprop="recipeIngredient"]`)  
**Structure**: Uses text parsing for all structure  
**Sections**: Attempts to detect from headings

## Test Expectations

Each fixture should be tested to verify:
- ✅ Correct extraction method chosen (WPRM > Data Attrs > JSON-LD > HTML)
- ✅ Ingredients have `amount`, `unit`, `name` parsed correctly
- ✅ Sections detected where present (optional field)
- ✅ Instructions extracted and cleaned
- ✅ Metadata present: title, description, image, servings, prep/cook times

