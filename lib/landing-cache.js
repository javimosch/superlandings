/**
 * Helpers for keeping the on-disk landing cache in sync with the canonical
 * `data/landings/<slug>` source.
 */

const fs = require('fs');
const path = require('path');
const { DATA_DIR, LANDINGS_DIR } = require('./db');
const { isValidSlug, safeSlugPath } = require('./utils');

function copyDirSync(source, destination) {
  fs.mkdirSync(destination, { recursive: true });

  const items = fs.readdirSync(source);
  for (const item of items) {
    const sourcePath = path.join(source, item);
    const destPath = path.join(destination, item);
    const stat = fs.statSync(sourcePath);

    if (stat.isDirectory()) {
      copyDirSync(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
      fs.utimesSync(destPath, stat.atime, stat.mtime);
    }
  }
}

/**
 * Refresh the cached copies of a landing.
 *
 * Copies the canonical `data/landings/<slug>` directory into both
 * `data/landing-cache/<slug>` (dashed) and `data/landing-cache/<undashed>`
 * (without dashes). This covers the two cache variants used by the runtime.
 *
 * @param {string} slug
 * @param {Object} [options]
 * @param {string} [options.landingsDir]
 * @param {string} [options.cacheRoot]
 * @returns {string[]} The cache directories that were written.
 */
function refreshLandingCache(slug, options = {}) {
  if (!isValidSlug(slug)) {
    throw new Error(`Invalid slug: ${slug}`);
  }

  const landingsDir = options.landingsDir || LANDINGS_DIR;
  const cacheRoot = options.cacheRoot || path.join(DATA_DIR, 'landing-cache');

  const sourceDir = safeSlugPath(landingsDir, slug);
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Landing source not found: ${sourceDir}`);
  }

  fs.mkdirSync(cacheRoot, { recursive: true });

  // The runtime may look for the cache with or without dashes in the slug.
  const targets = new Set([slug, slug.replace(/-/g, '')]);

  const written = [];
  for (const target of targets) {
    const targetDir = path.join(cacheRoot, target);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    copyDirSync(sourceDir, targetDir);
    written.push(targetDir);
  }

  return written;
}

module.exports = {
  refreshLandingCache,
};
