const fs = require('fs');
const path = require('path');

/**
 * i18n middleware for EJS templates
 * Detects language from query parameter, URL parameter (set by route handlers), or Accept-Language header
 */
function i18nMiddleware(landingDir) {
  return async function(req, res, next) {
    try {
      // Priority order: query parameter > URL parameter (set by route handlers) > Accept-Language header
      let lang = req.query.lang;
      
      if (!lang || (lang !== 'fr' && lang !== 'en')) {
        // Try URL parameter (set by landing-specific language routes)
        lang = req.params.lang;
      }
      
      if (!lang || (lang !== 'fr' && lang !== 'en')) {
        // Fallback to Accept-Language header
        lang = detectLanguageFromHeaders(req);
      }

      // Load translations
      const translations = loadTranslations(landingDir, lang);

      // Make translations available to EJS templates
      res.locals.t = translations;
      res.locals.lang = lang;
      res.locals.currentPath = req.path;

      next();
    } catch (error) {
      console.error('i18n middleware error:', error);
      // Fallback to English if i18n fails
      res.locals.t = loadTranslations(landingDir, 'en');
      res.locals.lang = 'en';
      next();
    }
  };
}

/**
 * Detect language from Accept-Language header
 */
function detectLanguageFromHeaders(req) {
  const acceptLanguage = req.headers['accept-language'] || '';
  if (acceptLanguage.startsWith('fr')) {
    return 'fr';
  }
  return 'en'; // Default to English
}

/**
 * Load translation JSON file
 */
function loadTranslations(landingDir, lang) {
  const localePath = path.join(landingDir, 'locales', `${lang}.json`);
  
  if (fs.existsSync(localePath)) {
    try {
      const content = fs.readFileSync(localePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error loading locale file ${localePath}:`, error);
    }
  }

  // Fallback to English if requested language not found
  if (lang !== 'en') {
    const enPath = path.join(landingDir, 'locales', 'en.json');
    if (fs.existsSync(enPath)) {
      try {
        const content = fs.readFileSync(enPath, 'utf8');
        return JSON.parse(content);
      } catch (error) {
        console.error(`Error loading fallback locale file ${enPath}:`, error);
      }
    }
  }

  return {};
}

/**
 * Helper function to get translation by key path
 * Usage: t('nav.features') or t('hero.title')
 */
function createTranslationHelper(translations) {
  return function(key) {
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }
    
    return value;
  };
}

module.exports = {
  i18nMiddleware,
  createTranslationHelper,
  loadTranslations
};
