/**
 * Sandbox the data directory for unit tests that exercise fs/db code.
 * Require this as the FIRST line of a test file, before any lib/* require.
 * Creates a unique temp dir per process and points SL_DATA_DIR at it.
 */
const os = require('os');
const fs = require('fs');
const path = require('path');

if (!process.env.SL_DATA_DIR) {
  process.env.SL_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-test-'));
}
process.env.PERSISTENCE_ENGINE = 'json';

module.exports = process.env.SL_DATA_DIR;
