const fs = require('fs');
const path = require('path');

function getDefaultBundle(landingDir) {
  const candidates = [
    path.join(landingDir, 'i18n.json'),
    path.join(landingDir, 'locales', 'en.json'),
    path.join(landingDir, 'locales', 'fr.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const raw = fs.readFileSync(candidate, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            locale: parsed.locale || 'en',
            entries: parsed.entries || parsed,
          };
        }
      } catch (e) {
        console.warn('[i18n] Could not parse bundle:', candidate, e.message);
      }
    }
  }

  return { locale: 'en', entries: {} };
}

function interpolate(template, vars = {}) {
  const str = String(template || '');
  return str.replace(/\{([a-zA-Z0-9_\-.]+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return String(vars[key]);
    }
    return match;
  });
}

function createTranslationHelper(bundle = {}) {
  const entries = bundle && typeof bundle === 'object' ? (bundle.entries || bundle) : {};

  return function t(key, vars = {}) {
    if (typeof key !== 'string') return '';
    const raw = Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : key;
    return interpolate(raw, vars);
  };
}

function i18nMiddleware(landingDir) {
  return async function i18n(req, res, next) {
    try {
      const bundle = getDefaultBundle(landingDir);
      res.locals.t = createTranslationHelper(bundle);
      res.locals.locale = bundle.locale;
      next();
    } catch (e) {
      console.error('[i18n] Middleware error:', e);
      next(e);
    }
  };
}

module.exports = {
  i18nMiddleware,
  createTranslationHelper,
};
