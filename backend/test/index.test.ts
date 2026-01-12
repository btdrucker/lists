#!/usr/bin/env tsx
/**
 * Main test runner - discovers and runs all fixture tests
 */

import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
}

/**
 * Run a single test file
 */
function runTest(testPath: string): Promise<TestResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const testName = testPath.split('/').pop()?.replace('.test.ts', '') || testPath;

    const child = spawn('npx', ['tsx', testPath], {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      resolve({
        name: testName,
        passed: code === 0,
        duration,
      });
    });
  });
}

/**
 * Discover all test files in fixtures directory
 */
function discoverTests(): string[] {
  const fixturesDir = join(__dirname, 'fixtures');
  const files = readdirSync(fixturesDir);

  return files
    .filter(f => f.endsWith('.test.ts'))
    .map(f => join(fixturesDir, f))
    .sort();
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🧪 EditRecipe Scraper Test Suite\n');
  console.log('━'.repeat(70));

  const testFiles = discoverTests();

  if (testFiles.length === 0) {
    console.log('⚠️  No test files found in test/fixtures/');
    process.exit(1);
  }

  console.log(`\nFound ${testFiles.length} test(s)\n`);

  const results: TestResult[] = [];

  for (const testFile of testFiles) {
    const result = await runTest(testFile);
    results.push(result);
  }

  // Summary
  console.log('\n' + '━'.repeat(70));
  console.log('📊 TEST SUMMARY\n');

  results.forEach(({ name, passed, duration }) => {
    const status = passed ? '✅' : '❌';
    const time = `(${duration}ms)`;
    console.log(`  ${status} ${name.padEnd(50)} ${time}`);
  });

  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log('\n' + '━'.repeat(70));
  console.log(`Total: ${results.length} | Passed: ${totalPassed} | Failed: ${totalFailed}`);
  console.log(`Duration: ${totalDuration}ms`);
  console.log('━'.repeat(70) + '\n');

  if (totalFailed > 0) {
    console.log('❌ Some tests failed\n');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
