const express = require('express');
const { readDB, writeDB, migrateDomains } = require('../lib/db');
const { deployTraefikConfig, removeTraefikConfig } = require('../lib/traefik');

const router = express.Router({ mergeParams: true });

// Publish landing
router.post('/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    
    const landing = db.landings.find(l => l.id === id);
    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    landing.domains = migrateDomains(landing.domains || []);

    if (landing.domains.length === 0) {
      return res.status(400).json({ error: 'At least one domain is required before publishing' });
    }

    landing.domains = landing.domains.map(d => ({ ...d, published: true }));
    
    const domainStrings = landing.domains.map(d => d.domain);
    console.log(`🚀 Publishing landing: ${landing.name} (${landing.slug}) to domains: ${domainStrings.join(', ')}`);

    const configFileName = await deployTraefikConfig(landing);
    
    landing.published = true;
    landing.traefikConfigFile = configFileName;
    writeDB(db);

    const domainUrls = landing.domains.map(d => `https://${d.domain}`).join(', ');
    console.log(`✅ Landing published successfully: ${domainUrls}`);

    res.json({ 
      success: true, 
      message: `Landing published to: ${domainUrls}`,
      landing 
    });
  } catch (error) {
    console.error('❌ Error publishing landing:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unpublish landing
router.post('/unpublish', async (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    
    const landing = db.landings.find(l => l.id === id);
    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    if (!landing.published) {
      return res.status(400).json({ error: 'Landing is not published' });
    }

    console.log(`📤 Unpublishing landing: ${landing.name} (${landing.slug})`);

    landing.domains = migrateDomains(landing.domains || []).map(d => ({ ...d, published: false }));

    await removeTraefikConfig(landing);
    
    landing.published = false;
    landing.traefikConfigFile = '';
    writeDB(db);

    console.log(`✅ Landing unpublished successfully`);

    res.json({ 
      success: true, 
      message: 'Landing unpublished successfully',
      landing 
    });
  } catch (error) {
    console.error('❌ Error unpublishing landing:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
