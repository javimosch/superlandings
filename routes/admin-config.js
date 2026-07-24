const express = require('express');
const { migrateDomains, getAllDomainStrings } = require('../lib/db');
const { readDB, readDBMeta, writeDB } = require('../lib/store');
const { deployAdminTraefikConfig, removeAdminTraefikConfig, validateTraefikEnv } = require('../lib/traefik');
const { getTraefikSetting, getTraefikFallbacks } = require('../lib/traefik-settings');

const saasbackend = process.env.NODE_ENV === 'production'
  ? require('saasbackend')
  : require('../ref-saasbackend');

const router = express.Router();

// Get environment fallbacks (merged with saved DB settings)
router.get('/fallbacks', async (req, res) => {
  try {
    const fallbacks = getTraefikFallbacks();

    // Merge saved settings from DB (overrides env defaults)
    const useMongo = process.env.PERSISTENCE_ENGINE === 'mongo' && saasbackend.models?.GlobalSetting;
    if (useMongo) {
      const GlobalSetting = saasbackend.models.GlobalSetting;
      const saved = await GlobalSetting.find({}).lean();
      for (const s of saved) {
        if (s.value !== undefined && s.value !== '') {
          // Mask sensitive keys — only report that they're set, not the actual value
          if (s.key === 'LLM_OPENROUTER_API_KEY' || s.key === 'TRAEFIK_SSH_KEY') {
            fallbacks[s.key] = '********';
          } else {
            fallbacks[s.key] = s.value;
          }
        }
      }
    } else {
      const db = await readDBMeta();
      const savedSettings = db.settings || {};
      for (const [key, value] of Object.entries(savedSettings)) {
        if (value !== undefined && value !== '') {
          if (key === 'LLM_OPENROUTER_API_KEY' || key === 'TRAEFIK_SSH_KEY') {
            fallbacks[key] = '********';
          } else {
            fallbacks[key] = value;
          }
        }
      }
    }

    res.json(fallbacks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get admin config
router.get('/', async (req, res) => {
  const db = await readDBMeta();
  const adminConfig = db.adminConfig || { domains: [], published: false, traefikConfigFile: '' };
  adminConfig.domains = migrateDomains(adminConfig.domains || []);
  res.json(adminConfig);
});

// Update admin domains
router.put('/domains', async (req, res) => {
  try {
    const { domains } = req.body;
    const db = await readDB();
    
    if (!db.adminConfig) {
      db.adminConfig = { domains: [], published: false, traefikConfigFile: '' };
    }

    if (!Array.isArray(domains)) {
      return res.status(400).json({ error: 'Domains must be an array' });
    }

    const newDomains = domains.map(d => {
      if (typeof d === 'string') {
        return { domain: d, published: false };
      }
      return d;
    });

    const oldDomainStrings = getAllDomainStrings(db.adminConfig.domains || []);
    const newDomainStrings = newDomains.map(d => d.domain);
    console.log(`🌐 Updating admin domains: [${oldDomainStrings.join(', ')}] -> [${newDomainStrings.join(', ')}]`);

    db.adminConfig.domains = newDomains;
    await writeDB(db);

    console.log(`✅ Admin domains updated successfully`);

    res.json({ success: true, adminConfig: db.adminConfig });
  } catch (error) {
    console.error('❌ Error updating admin domains:', error);
    res.status(500).json({ error: error.message });
  }
});

// Publish admin
router.post('/publish', async (req, res) => {
  try {
    const { sshKey } = req.body;
    const db = await readDB();
    
    if (!db.adminConfig) {
      db.adminConfig = { domains: [], published: false, traefikConfigFile: '' };
    }

    db.adminConfig.domains = migrateDomains(db.adminConfig.domains || []);

    if (db.adminConfig.domains.length === 0) {
      return res.status(400).json({ error: 'At least one domain is required before publishing' });
    }

    db.adminConfig.domains = db.adminConfig.domains.map(d => ({ ...d, published: true }));
    
    const domainStrings = db.adminConfig.domains.map(d => d.domain);
    console.log(`🚀 Publishing admin to domains: ${domainStrings.join(', ')}`);

    const traefikEnabled = await getTraefikSetting('TRAEFIK_ENABLED');
    if (traefikEnabled === true || traefikEnabled === 'true') {
      await validateTraefikEnv();
      await deployAdminTraefikConfig(domainStrings, sshKey);
    }
    
    db.adminConfig.published = true;
    db.adminConfig.traefikConfigFile = 'superlandings-admin.yml';
    await writeDB(db);

    const domainUrls = db.adminConfig.domains.map(d => `https://${d.domain}`).join(', ');
    console.log(`✅ Admin published successfully: ${domainUrls}`);

    res.json({ 
      success: true, 
      message: `Admin published to: ${domainUrls}`,
      adminConfig: db.adminConfig
    });
  } catch (error) {
    console.error('❌ Error publishing admin:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unpublish admin
router.post('/unpublish', async (req, res) => {
  try {
    const { sshKey } = req.body;
    const db = await readDB();
    
    if (!db.adminConfig || !db.adminConfig.published) {
      return res.status(400).json({ error: 'Admin is not published' });
    }

    db.adminConfig.domains = migrateDomains(db.adminConfig.domains || []).map(d => ({ ...d, published: false }));

    console.log(`📤 Unpublishing admin`);

    const configFileName = db.adminConfig.traefikConfigFile || 'superlandings-admin.yml';

    const traefikEnabled = await getTraefikSetting('TRAEFIK_ENABLED');
    if (traefikEnabled === true || traefikEnabled === 'true') {
      await removeAdminTraefikConfig(configFileName, sshKey);
    }
    
    db.adminConfig.published = false;
    db.adminConfig.traefikConfigFile = '';
    await writeDB(db);

    console.log(`✅ Admin unpublished successfully`);

    res.json({ 
      success: true, 
      message: 'Admin unpublished successfully',
      adminConfig: db.adminConfig
    });
  } catch (error) {
    console.error('❌ Error unpublishing admin:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save Traefik/LLM settings (upserts into saasbackend GlobalSetting or JSON store)
router.put('/settings', async (req, res) => {
  if (!req.adminAuth) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }
    const results = [];
    const useMongo = process.env.PERSISTENCE_ENGINE === 'mongo' && saasbackend.models?.GlobalSetting;

    if (useMongo) {
      const GlobalSetting = saasbackend.models.GlobalSetting;
      for (const [key, value] of Object.entries(settings)) {
        if (value === undefined || value === null || value === '') continue;
        let normalizedValue = typeof value === 'string' ? value.trim() : String(value);
        if (key === 'TRAEFIK_SSH_KEY' && normalizedValue) normalizedValue += '\n';
        const type = key === 'TRAEFIK_ENABLED' ? 'boolean' : 'string';
        let setting = await GlobalSetting.findOne({ key });
        if (setting) { setting.value = normalizedValue; await setting.save(); }
        else { await GlobalSetting.create({ key, value: normalizedValue, type, description: `Traefik setting: ${key}` }); }
        results.push({ key, status: 'saved' });
      }
      if (saasbackend.services?.globalSettings?.clearSettingsCache) {
        saasbackend.services.globalSettings.clearSettingsCache();
      }
    } else {
      // JSON persistence fallback — save in db.settings
      const db = await readDB();
      if (!db.settings) db.settings = {};
      for (const [key, value] of Object.entries(settings)) {
        if (value === undefined || value === null || value === '') continue;
        let normalizedValue = typeof value === 'string' ? value.trim() : String(value);
        if (key === 'TRAEFIK_SSH_KEY' && normalizedValue) normalizedValue += '\n';
        db.settings[key] = normalizedValue;
        results.push({ key, status: 'saved' });
      }
      await writeDB(db);
    }
    res.json({ success: true, saved: results.length, results });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
