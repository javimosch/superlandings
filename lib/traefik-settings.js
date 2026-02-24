const saasbackend = process.env.NODE_ENV === 'production'
  ? require('saasbackend')
  : require('../ref-saasbackend');

/**
 * Gets a Traefik configuration value from SaasBackend global settings
 * with a fallback to process.env.
 * 
 * @param {string} key - The setting key (e.g., 'TRAEFIK_ENABLED')
 * @returns {Promise<string|boolean|null>}
 */
async function getTraefikSetting(key) {
  try {
    // If saasbackend services are initialized and we are in middleware mode
    if (saasbackend.services && saasbackend.services.globalSettings) {
      const value = await saasbackend.services.globalSettings.getSettingValue(key);
      if (value !== null && value !== undefined && value !== '') {
        // Handle boolean strings
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
      }
    }
  } catch (err) {
    console.error(`Error fetching setting ${key} from saasbackend:`, err);
  }

  // Fallback to process.env
  const envValue = process.env[key];
  if (envValue === 'true') return true;
  if (envValue === 'false') return false;
  return envValue || null;
}

/**
 * Returns all Traefik settings as an object
 */
async function getAllTraefikSettings() {
  const keys = [
    'TRAEFIK_ENABLED',
    'TRAEFIK_REMOTE_HOST',
    'TRAEFIK_REMOTE_USER',
    'TRAEFIK_REMOTE_PORT',
    'TRAEFIK_REMOTE_PATH',
    'SERVER_IP',
    'TRAEFIK_SSH_KEY',
    'LLM_OPENROUTER_API_KEY',
    'LLM_MODEL',
    'LLM_TEMPERATURE',
    'LLM_TIMEOUT_SECONDS'
  ];

  const settings = {};
  for (const key of keys) {
    settings[key] = await getTraefikSetting(key);
  }
  return settings;
}

/**
 * Returns the fallback environment values for Traefik settings
 */
function getTraefikFallbacks() {
  const keys = [
    'TRAEFIK_ENABLED',
    'TRAEFIK_REMOTE_HOST',
    'TRAEFIK_REMOTE_USER',
    'TRAEFIK_REMOTE_PORT',
    'TRAEFIK_REMOTE_PATH',
    'SERVER_IP',
    'TRAEFIK_SSH_KEY',
    'LLM_OPENROUTER_API_KEY',
    'LLM_MODEL',
    'LLM_TEMPERATURE',
    'LLM_TIMEOUT_SECONDS'
  ];

  const fallbacks = {};
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== '') {
      fallbacks[key] = value;
    }
  }
  return fallbacks;
}

module.exports = {
  getTraefikSetting,
  getAllTraefikSettings,
  getTraefikFallbacks
};
