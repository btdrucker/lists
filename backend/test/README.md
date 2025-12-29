# Recipe Scraper Tests

This directory contains tests for the recipe scraper functionality.

## Quick Start

### 1. Download HTML fixtures from recipe sites:

```bash
cd backend
npm run download-fixture -- https://www.budgetbytes.com/curried-red-lentil-and-pumpkin-soup/
```

The `--` separates npm's arguments from the script's arguments.

Optional: specify a custom filename (auto-generates from URL by default):
```bash
npm run download-fixture -- https://example.com/recipe custom-name.html
```

See [`fixtures/README.md`](fixtures/README.md) for details on adding fixtures.

### 2. Run tests:

```bash
npm test                                    # Run all tests
npm run test:single fixtures/curried-red-lentil-and-pumpkin-soup.test.ts  # Run one test
```

## Directory Structure

```
test/
├── README.md                           # This file
├── index.test.ts                       # Main test runner (discovers all fixture tests)
├── fixtures/                           # HTML fixtures and their tests
│   ├── README.md                       # Fixture documentation
│   ├── curried-red-lentil.html         # HTML fixture
│   ├── curried-red-lentil.test.ts     # Test for this fixture
│   └── ...                             # More fixtures + tests
└── download-fixture.ts                 # Helper script to download HTML
```

Each fixture gets its own standalone test file. The main test runner (`index.test.ts`) automatically discovers and runs all fixture tests.

## Scripts

```bash
npm test                                                 # Run all tests (via index.test.ts)
npm run test:single test/fixtures/<fixture>.test.ts     # Run single test directly
npm run download-fixture -- <url>                        # Download HTML + generate test file
npm run download-fixture -- <url> <file>                 # Download with custom filename
```

**How it works:**
- `npm test` runs `test/index.test.ts`, which discovers and runs all `test/fixtures/*.test.ts` files
- When you download a fixture, a test file is automatically generated alongside it
- Add future test types (unit tests, integration tests) to `index.test.ts`

## Test Coverage

We test against multiple recipe sites to cover different scraping patterns:

- **WPRM Plugin** (Budget Bytes) - Full structured data with sections
- **Data Attributes** (AllRecipes, Serious Eats) - `data-ingredient-*` attributes
- **JSON-LD** (NYT Cooking, Bon Appétit) - JSON-LD with text parsing
- **Generic HTML** - Fallback for any other sites

For specific site patterns and fixture details, see [`fixtures/README.md`](fixtures/README.md).

## Future Improvements

- [x] Refactor scraper to accept HTML directly (not just URL fetch) ✅
- [x] Auto-generate test files when downloading fixtures ✅
- [ ] Add proper test assertions (currently just logs)
- [ ] Add snapshot testing for full recipe objects
- [ ] Test error cases (malformed HTML, missing data)
- [ ] Performance benchmarks

