const express = require('express');
const { readDB, writeDB } = require('../lib/db');
const { migrateExistingLandings } = require('../lib/migrate-versions');

const router = express.Router();

// RBAC Migration - seed default organization and update landings
router.post('/rbac', (req, res) => {
  if (!req.adminAuth) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const db = readDB();
    let changes = { organizationCreated: false, landingsUpdated: 0 };

    // Initialize arrays if not exist
    if (!db.organizations) db.organizations = [];
    if (!db.users) db.users = [];

    // Check if default organization exists
    let defaultOrg = db.organizations.find(o => o.name === 'default');
    
    if (!defaultOrg) {
      defaultOrg = {
        id: 'default',
        name: 'default',
        users: [],
        createdAt: new Date().toISOString()
      };
      db.organizations.push(defaultOrg);
      changes.organizationCreated = true;
      console.log(`✅ Created default organization`);
    }

    // Update landings without organizationId
    const landings = db.landings || [];
    landings.forEach(landing => {
      if (!landing.organizationId) {
        landing.organizationId = defaultOrg.id;
        changes.landingsUpdated++;
      }
    });

    writeDB(db);

    const message = [];
    if (changes.organizationCreated) {
      message.push('Created "default" organization');
    } else {
      message.push('"default" organization already exists');
    }
    
    if (changes.landingsUpdated > 0) {
      message.push(`Updated ${changes.landingsUpdated} landing(s) with organizationId`);
    } else {
      message.push('No landings needed updating');
    }

    console.log(`✅ RBAC Migration completed: ${message.join(', ')}`);
    
    res.json({ 
      success: true, 
      message: message.join('. '),
      changes
    });
  } catch (error) {
    console.error('❌ Error running RBAC migration:', error);
    res.status(500).json({ error: error.message });
  }
});

// Move landing to another organization (admin only)
router.post('/move-landing', (req, res) => {
  if (!req.adminAuth) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { landingId, targetOrganizationId } = req.body;

    if (!landingId || !targetOrganizationId) {
      return res.status(400).json({ error: 'landingId and targetOrganizationId are required' });
    }

    const db = readDB();
    
    // Check target organization exists
    const orgs = db.organizations || [];
    const targetOrg = orgs.find(o => o.id === targetOrganizationId);
    if (!targetOrg) {
      return res.status(404).json({ error: 'Target organization not found' });
    }

    // Find and update landing
    const landings = db.landings || [];
    const landing = landings.find(l => l.id === landingId);
    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    const oldOrgId = landing.organizationId;
    landing.organizationId = targetOrganizationId;
    writeDB(db);

    console.log(`✅ Landing "${landing.name}" moved from org ${oldOrgId} to ${targetOrganizationId}`);
    
    res.json({ 
      success: true, 
      message: `Landing moved to "${targetOrg.name}"`,
      landing
    });
  } catch (error) {
    console.error('❌ Error moving landing:', error);
    res.status(500).json({ error: error.message });
  }
});

// Version Migration - add version tracking to existing landings
router.post('/versions', (req, res) => {
  if (!req.adminAuth) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const migratedCount = migrateExistingLandings();
    
    res.json({ 
      success: true, 
      message: `Version migration completed. ${migratedCount} landings processed.`,
      migratedCount
    });
  } catch (error) {
    console.error('❌ Error running version migration:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
