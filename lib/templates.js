/**
 * Helpers for managing the Express/EJS template cache at runtime.
 */

/**
 * Clear the Express view cache and the EJS compiled-function cache.
 * This lets template changes be picked up without a container restart.
 *
 * @param {import('express').Application} app
 */
function clearTemplateCache(app) {
  if (app && typeof app.cache === 'object' && app.cache !== null) {
    app.cache = {};
  }

  try {
    const ejs = require('ejs');
    if (ejs && typeof ejs.clearCache === 'function') {
      ejs.clearCache();
    }
  } catch (err) {
    // EJS may not be installed in this environment (e.g. during some test runs).
    // The Express view cache is still cleared above.
  }
}

module.exports = {
  clearTemplateCache,
};
