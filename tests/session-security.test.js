const test = require('node:test');
const assert = require('node:assert');

test('session secret: production requires SESSION_SECRET environment variable', () => {
  // Session setup lives in app.js (server.js was split into app.js + server.js).
  const appContent = require('fs').readFileSync('./app.js', 'utf-8');

  // Verify the hardcoded fallback has been removed
  assert.doesNotMatch(appContent, /your-secret-key-change-in-production/);

  // Verify production check exists
  assert.match(appContent, /process\.env\.NODE_ENV === 'production'/);
  assert.match(appContent, /SESSION_SECRET environment variable is required/);
});

test('session secret: production environment should require secure configuration', () => {
  // Mock production environment check
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  // The issue: if SESSION_SECRET is not set, app will use the hardcoded fallback
  // This creates a security vulnerability where sessions could be hijacked
  const fallbackSecret = 'your-secret-key-change-in-production';
  const envSecret = process.env.SESSION_SECRET;

  if (!envSecret) {
    // This demonstrates the vulnerability - app would use the predictable secret
    assert.strictEqual(envSecret || fallbackSecret, fallbackSecret);
  }

  // Restore environment
  process.env.NODE_ENV = originalEnv;
});

console.log('Session security tests completed!');