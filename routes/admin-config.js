const express = require('express');
const { readDB, writeDB, migrateDomains, getAllDomainStrings } = require('../lib/db');
const { deployAdminTraefikConfig, removeAdminTraefikConfig, validateTraefikEnv } = require('../lib/traefik');

const router = express.Router();

// Get admin config
router.get('/', (req, res) => {
  const db = readDB();
  const adminConfig = db.adminConfig || { domains: [], published: false, traefikConfigFile: '' };
  adminConfig.domains = migrateDomains(adminConfig.domains || []);
  res.json(adminConfig);
});

// Update admin domains
router.put('/domains', (req, res) => {
  try {
    const { domains } = req.body;
    const db = readDB();
    
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
    writeDB(db);

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
    const db = readDB();
    
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

    if (process.env.TRAEFIK_ENABLED === 'true') {
      validateTraefikEnv();
      await deployAdminTraefikConfig(domainStrings);
    }
    
    db.adminConfig.published = true;
    db.adminConfig.traefikConfigFile = 'superlandings-admin.yml';
    writeDB(db);

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
    const db = readDB();
    
    if (!db.adminConfig || !db.adminConfig.published) {
      return res.status(400).json({ error: 'Admin is not published' });
    }

    db.adminConfig.domains = migrateDomains(db.adminConfig.domains || []).map(d => ({ ...d, published: false }));

    console.log(`📤 Unpublishing admin`);

    const configFileName = db.adminConfig.traefikConfigFile || 'superlandings-admin.yml';

    if (process.env.TRAEFIK_ENABLED === 'true') {
      await removeAdminTraefikConfig(configFileName);
    }
    
    db.adminConfig.published = false;
    db.adminConfig.traefikConfigFile = '';
    writeDB(db);

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

module.exports = router;
