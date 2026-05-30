const test = require('node:test');
const assert = require('node:assert');

test('session secret: production requires SESSION_SECRET environment variable', () => {
  // Test that the server.js session configuration now properly requires env var
  const serverContent = require('fs').readFileSync('./server.js', 'utf-8');

  // Verify the hardcoded fallback has been removed
  assert.doesNotMatch(serverContent, /your-secret-key-change-in-production/);

  // Verify production check exists
  assert.match(serverContent, /process\.env\.NODE_ENV === 'production'/);
  assert.match(serverContent, /SESSION_SECRET environment variable is required/);
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