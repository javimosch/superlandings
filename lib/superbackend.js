const fs = require('fs');
const path = require('path');

const REF_PATH = path.join(__dirname, '..', 'ref-saasbackend');
const REF_INDEX = path.join(REF_PATH, 'index.js');
const REF_PKG = path.join(REF_PATH, 'package.json');

// Prevent the vendored/published backend from re-loading dotenv when used as middleware.
// The main app loads dotenv before mounting the backend.
if (!process.env.SUPERBACKEND_AS_MIDDLEWARE) {
  process.env.SUPERBACKEND_AS_MIDDLEWARE = 'true';
}

function loadSuperBackend() {
  // Prefer the vendored ref-saasbackend source when it is present and installed.
  // This covers the workflow described in issue #14: vendored source with
  // its own package.json that gets installed in the Docker build.
  if (fs.existsSync(REF_PKG) && fs.existsSync(REF_INDEX)) {
    try {
      return require('../ref-saasbackend');
    } catch (err) {
      console.warn('[lib/superbackend] ref-saasbackend found but failed to load:', err.message);
    }
  }

  // Use the public successor package that replaced the old `saasbackend` package.
  try {
    return require('@intranefr/superbackend');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.warn('[lib/superbackend] @intranefr/superbackend not installed. AI/SaaS features will be disabled.');
    } else {
      console.warn('[lib/superbackend] Failed to load @intranefr/superbackend:', err.message);
    }
  }

  // Legacy package name as a last resort.
  try {
    return require('saasbackend');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.warn('[lib/superbackend] saasbackend not installed. AI/SaaS features will be disabled.');
    } else {
      console.warn('[lib/superbackend] Failed to load saasbackend:', err.message);
    }
  }

  // Safe stub so the app can still boot and serve non-AI pages.
  return {
    middleware: () => (req, res, next) => {
      if (typeof next === 'function') next();
    },
    services: {},
    models: {},
    helpers: {},
  };
}

module.exports = loadSuperBackend();
