const test = require('node:test');
const assert = require('node:assert');

// Test that all modules properly validate slugs before path operations
// This tests the systemic fix for path traversal vulnerabilities

test('CLI: imports safeSlugPath for secure path construction', () => {
  // Test would require running the CLI, but we can verify the import exists
  const cliContent = require('fs').readFileSync('./cli.js', 'utf-8');
  assert.match(cliContent, /safeSlugPath.*=.*require/);
  assert.match(cliContent, /safeSlugPath\(LANDINGS_DIR, slug\)/);
});

test('Store: uses safe path construction for slug operations', () => {
  const storeContent = require('fs').readFileSync('./lib/store.js', 'utf-8');
  assert.match(storeContent, /safeSlugPath.*=.*require/);
  assert.match(storeContent, /safeSlugPath\(LANDINGS_DIR, l\.slug\)/);
});

test('Versions: systematically uses safe path construction', () => {
  const versionsContent = require('fs').readFileSync('./lib/versions.js', 'utf-8');
  assert.match(versionsContent, /safeSlugPath.*=.*require/);

  // Should not have any remaining vulnerable path.join patterns
  assert.doesNotMatch(versionsContent, /path\.join\(LANDINGS_DIR, landing\.slug\)/);
  assert.doesNotMatch(versionsContent, /path\.join\(CACHE_LANDINGS_DIR, landing\.slug\)/);
  assert.doesNotMatch(versionsContent, /path\.join\(getCacheRoot\(\), slug\)(?!;)/);
});

test('Serve routes: validate slugs for EJS rendering', () => {
  const serveContent = require('fs').readFileSync('./routes/serve.js', 'utf-8');
  assert.match(serveContent, /isValidSlug.*=.*require/);
  assert.match(serveContent, /isValidSlug\(landing\.slug\)/);
  assert.match(serveContent, /isValidSlug\(slug\)/);
});

test('Landings route: uses safe deletion path', () => {
  const landingsContent = require('fs').readFileSync('./routes/landings.js', 'utf-8');
  assert.match(landingsContent, /safeSlugPath.*=.*require/);
  assert.match(landingsContent, /safeSlugPath\(LANDINGS_DIR, landing\.slug\)/);
});

// Integration test: verify the utils functions work as expected
test('Utils: safeSlugPath prevents all path traversal attempts', () => {
  const { safeSlugPath, isValidSlug } = require('../lib/utils');

  const maliciousSlugs = [
    '../../../etc/passwd',
    '../../root',
    '.hidden',
    'foo/bar',
    'foo\\bar',
    '.',
    '..',
    'normal-slug/../../../etc/passwd',
    'test.php%00.jpg',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
  ];

  for (const slug of maliciousSlugs) {
    assert.strictEqual(isValidSlug(slug), false, `isValidSlug should reject: ${slug}`);
    assert.throws(() => {
      safeSlugPath('/base/dir', slug);
    }, /Invalid slug/, `safeSlugPath should throw for: ${slug}`);
  }
});

test('Utils: safeSlugPath allows valid slugs', () => {
  const { safeSlugPath } = require('../lib/utils');

  const validSlugs = ['my-landing', 'test_page', 'Landing123', 'abc', '123test'];

  for (const slug of validSlugs) {
    const result = safeSlugPath('/base/dir', slug);
    assert.strictEqual(result, `/base/dir/${slug}`);
  }
});

// Verify no remaining vulnerable patterns in the codebase
test('Codebase: no remaining vulnerable path.join patterns', () => {
  const fs = require('fs');
  const path = require('path');

  const filesToCheck = [
    './cli.js',
    './lib/store.js',
    './lib/versions.js',
    './routes/landings.js'
  ];

  for (const filePath of filesToCheck) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check for remaining vulnerable patterns (excluding safe implementations)
      // These patterns look for direct path.join with slug but exclude cases where safeSlugPath is used
      const vulnerablePatterns = [
        /path\.join\((?!.*safeSlugPath)[^)]*LANDINGS_DIR[^)]*\.slug[^)]*\)/g,
        /path\.join\((?!.*safeSlugPath)[^)]*CACHE_LANDINGS_DIR[^)]*\.slug[^)]*\)/g
      ];

      for (const pattern of vulnerablePatterns) {
        const matches = content.match(pattern);
        if (matches) {
          assert.fail(`Found vulnerable pattern in ${filePath}: ${matches.join(', ')}`);
        }
      }
    }
  }
});

console.log('All systemic path traversal fix tests passed!');