/**
 * Stub ref-saasbackend (which has top-level side-effects / network init)
 * so modules under test (lib/traefik-settings, lib/llm, lib/traefik) can load
 * in isolation. Require this once at the top of a unit test file.
 */
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const refPath = path.join(ROOT, 'ref-saasbackend', 'index.js');

if (!require.cache[refPath]) {
  const m = new Module(refPath, module);
  m.filename = refPath;
  m.loaded = true;
  m.exports = {
    services: {},
    middleware: () => (req, res, next) => next(),
  };
  require.cache[refPath] = m;
}

module.exports = refPath;
