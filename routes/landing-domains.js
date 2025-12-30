const express = require('express');
const { migrateDomains } = require('../lib/db');
const { readDB, writeDB } = require('../lib/store');
const { deployTraefikConfig, removeTraefikConfig } = require('../lib/traefik');
const { hasRight } = require('../lib/auth');
const { logAudit, AUDIT_ACTIONS } = require('../lib/audit');

const router = express.Router({ mergeParams: true });

// Publish specific domain
router.post('/:domain/publish', async (req, res) => {
  // Check permission
  if (!req.adminAuth && !hasRight(req.currentUser, 'landings:domains')) {
    return res.status(403).json({ error: 'Missing permission: landings:domains' });
  }

  try {
    const { id, domain } = req.params;
    const db = await readDB();
    
    const landing = db.landings.find(l => l.id === id);
    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    landing.domains = migrateDomains(landing.domains || []);
    const domainObj = landing.domains.find(d => d.domain === domain);
    if (!domainObj) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    if (domainObj.published) {
      return res.status(400).json({ error: 'Domain is already published' });
    }

    console.log(`🚀 Publishing domain ${domain} for landing: ${landing.name}`);

    domainObj.published = true;
    
    const configFileName = await deployTraefikConfig(landing);
    landing.traefikConfigFile = configFileName;
    landing.published = landing.domains.some(d => d.published);
    
    await writeDB(db);

    console.log(`✅ Domain ${domain} published successfully`);

    // Log audit event
    await logAudit(id, {
      action: AUDIT_ACTIONS.DOMAIN_PUBLISH,
      actor: req.currentUser?.email || 'admin',
      isAdmin: req.adminAuth,
      details: `Published domain: ${domain}`,
      metadata: { domain }
    });

    res.json({ 
      success: true, 
      message: `Domain ${domain} published successfully`,
      landing 
    });
  } catch (error) {
    console.error('❌ Error publishing domain:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unpublish specific domain
router.post('/:domain/unpublish', async (req, res) => {
  // Check permission
  if (!req.adminAuth && !hasRight(req.currentUser, 'landings:domains')) {
    return res.status(403).json({ error: 'Missing permission: landings:domains' });
  }

  try {
    const { id, domain } = req.params;
    const db = await readDB();
    
    const landing = db.landings.find(l => l.id === id);
    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    landing.domains = migrateDomains(landing.domains || []);
    const domainObj = landing.domains.find(d => d.domain === domain);
    if (!domainObj) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    if (!domainObj.published) {
      return res.status(400).json({ error: 'Domain is not published' });
    }

    console.log(`📤 Unpublishing domain ${domain} for landing: ${landing.name}`);

    domainObj.published = false;
    
    const hasPublishedDomains = landing.domains.some(d => d.published);
    
    if (hasPublishedDomains) {
      const configFileName = await deployTraefikConfig(landing);
      landing.traefikConfigFile = configFileName;
    } else {
      await removeTraefikConfig(landing);
      landing.traefikConfigFile = '';
    }
    
    landing.published = hasPublishedDomains;
    await writeDB(db);

    console.log(`✅ Domain ${domain} unpublished successfully`);

    // Log audit event
    await logAudit(id, {
      action: AUDIT_ACTIONS.DOMAIN_UNPUBLISH,
      actor: req.currentUser?.email || 'admin',
      isAdmin: req.adminAuth,
      details: `Unpublished domain: ${domain}`,
      metadata: { domain }
    });

    res.json({ 
      success: true, 
      message: `Domain ${domain} unpublished successfully`,
      landing 
    });
  } catch (error) {
    console.error('❌ Error unpublishing domain:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
