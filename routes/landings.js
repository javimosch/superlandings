const express = require('express');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { LANDINGS_DIR, migrateDomains } = require('../lib/db');
const { readDB, writeDB } = require('../lib/store');
const { deployTraefikConfig, removeTraefikConfig } = require('../lib/traefik');
const { hasRight } = require('../lib/auth');
const { createVersion, deleteAllVersions } = require('../lib/versions');
const { logAudit, deleteAuditLog, AUDIT_ACTIONS } = require('../lib/audit');
const landingDomainsRouter = require('./landing-domains');
const landingPublishRouter = require('./landing-publish');
const landingVersionsRouter = require('./landing-versions');
const landingAuditRouter = require('./landing-audit');

const router = express.Router();

// Mount sub-routers
router.use('/:id/domains', landingDomainsRouter);
router.use('/:id/versions', landingVersionsRouter);
router.use('/:id/audit', landingAuditRouter);
router.use('/:id', landingPublishRouter);

// Get all landings (filtered by organization for non-admin users)
router.get('/', async (req, res) => {
  const db = await readDB();
  let landings = db.landings || [];

  // Filter by organization if current organization is set
  if (req.currentOrganization) {
    landings = landings.filter(l => l.organizationId === req.currentOrganization.id);
  } else if (!req.adminAuth && req.userOrganizations) {
    // Fallback: show all user's organizations if no specific organization is selected
    const orgIds = req.userOrganizations.map(o => o.id);
    landings = landings.filter(l => orgIds.includes(l.organizationId));
  }

  landings = landings.map(landing => ({
    ...landing,
    domains: migrateDomains(landing.domains || [])
  }));
  res.json(landings);
});

// Create landing
router.post('/', async (req, res) => {
  // Check permission
  if (!req.adminAuth && !hasRight(req.currentUser, 'landings:create')) {
    return res.status(403).json({ error: 'Missing permission: landings:create' });
  }

  try {
    const { slug, type, name, domains, organizationId } = req.body;
    let parsedDomains = [];
    if (domains) {
      try {
        parsedDomains = typeof domains === 'string' ? JSON.parse(domains) : domains;
      } catch (e) {
        parsedDomains = [];
      }
    }
    const db = await readDB();

    if (db.landings.find(l => l.slug === slug)) {
      return res.status(400).json({ error: 'Slug already exists' });
    }

    const landingDir = path.join(LANDINGS_DIR, slug);
    if (!fs.existsSync(landingDir)) fs.mkdirSync(landingDir, { recursive: true });

    // Determine organization
    let orgId = organizationId;
    if (!req.adminAuth) {
      // Non-admin must use current organization
      if (!req.currentOrganization) {
        return res.status(400).json({ error: 'No organization selected' });
      }
      orgId = req.currentOrganization.id;
    }

    const landing = {
      id: Date.now().toString(),
      slug,
      name,
      type,
      organizationId: orgId || null,
      domains: Array.isArray(parsedDomains) ? parsedDomains : [],
      published: false,
      traefikConfigFile: '',
      createdAt: new Date().toISOString()
    };

    if (type === 'html') {
      const content = req.body.content || '<html><body><h1>New Landing</h1></body></html>';
      fs.writeFileSync(path.join(landingDir, 'index.html'), content);
    } else if (type === 'static' && req.files && req.files.length > 0) {
      const zipFile = req.files.find(f => f.originalname.endsWith('.zip'));
      if (zipFile) {
        const zip = new AdmZip(zipFile.path);
        zip.extractAllTo(landingDir, true);
        fs.unlinkSync(zipFile.path);
      } else {
        req.files.forEach(file => {
          const dest = path.join(landingDir, file.originalname);
          fs.renameSync(file.path, dest);
        });
      }
    } else if (type === 'ejs' && req.files && req.files.length > 0) {
      const zipFile = req.files.find(f => f.originalname.endsWith('.zip'));
      if (zipFile) {
        const zip = new AdmZip(zipFile.path);
        zip.extractAllTo(landingDir, true);
        fs.unlinkSync(zipFile.path);
      } else {
        req.files.forEach(file => {
          const dest = path.join(landingDir, file.originalname);
          fs.renameSync(file.path, dest);
        });
      }
    }

    // Create initial version
    const initialVersion = await createVersion(landing, 'Initial version');
    landing.currentVersionId = initialVersion.id;
    landing.currentVersionNumber = initialVersion.versionNumber;

    db.landings.push(landing);
    await writeDB(db);

    // Log audit event
    await logAudit(landing.id, {
      action: AUDIT_ACTIONS.CREATE,
      actor: req.currentUser?.email || 'admin',
      isAdmin: req.adminAuth,
      details: `Created ${type} landing "${name}"`,
      metadata: { slug, type, organizationId: orgId }
    });

    res.json(landing);
  } catch (error) {
    console.error('Error creating landing:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update landing
router.put('/:id', async (req, res) => {
  // Check permission
  if (!req.adminAuth && !hasRight(req.currentUser, 'landings:update')) {
    return res.status(403).json({ error: 'Missing permission: landings:update' });
  }

  try {
    const { id } = req.params;
    const { content } = req.body;
    const db = await readDB();

    const landing = db.landings.find(l => l.id === id);
    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    const landingDir = path.join(LANDINGS_DIR, landing.slug);

    if (landing.type === 'html') {
      fs.writeFileSync(path.join(landingDir, 'index.html'), content);

      // Create version after update
      const afterVersion = await createVersion(landing, 'Updated content');

      // Update landing to point to the new version
      landing.currentVersionId = afterVersion.id;
      landing.currentVersionNumber = afterVersion.versionNumber;

      await writeDB(db);

      // Log audit event with linked version
      await logAudit(id, {
        action: AUDIT_ACTIONS.UPDATE,
        actor: req.currentUser?.email || 'admin',
        isAdmin: req.adminAuth,
        details: 'Updated HTML content',
        metadata: { versionNumber: afterVersion.versionNumber },
        versionIds: [afterVersion.id]
      });

      res.json({ success: true });
    } else if (landing.type === 'ejs' && req.files && req.files.length > 0) {
      // Clear all existing files in the landing directory first
      const files = fs.readdirSync(landingDir);
      for (const file of files) {
        const filePath = path.join(landingDir, file);
        if (fs.statSync(filePath).isDirectory()) {
          fs.rmSync(filePath, { recursive: true });
        } else {
          fs.unlinkSync(filePath);
        }
      }

      const zipFile = req.files.find(f => f.originalname.endsWith('.zip'));
      if (zipFile) {
        const zip = new AdmZip(zipFile.path);
        zip.extractAllTo(landingDir, true);
        fs.unlinkSync(zipFile.path);
      } else {
        req.files.forEach(file => {
          const dest = path.join(landingDir, file.originalname);
          fs.renameSync(file.path, dest);
        });
      }

      // Create version after update
      const afterVersion = await createVersion(landing, 'Updated EJS files');

      // Update landing to point to the new version
      landing.currentVersionId = afterVersion.id;
      landing.currentVersionNumber = afterVersion.versionNumber;

      await writeDB(db);

      // Log audit event with linked version
      await logAudit(id, {
        action: AUDIT_ACTIONS.UPDATE,
        actor: req.currentUser?.email || 'admin',
        isAdmin: req.adminAuth,
        details: 'Updated EJS files',
        metadata: { versionNumber: afterVersion.versionNumber },
        versionIds: [afterVersion.id]
      });

      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Only HTML and EJS landings can be edited this way' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get landing content
router.get('/:id/content', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await readDB();

    const landing = db.landings.find(l => l.id === id);
    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    if (landing.type === 'html') {
      const landingDir = path.join(LANDINGS_DIR, landing.slug);
      const content = fs.readFileSync(path.join(landingDir, 'index.html'), 'utf-8');
      res.json({ content });
    } else {
      res.status(400).json({ error: 'Only HTML landings can be retrieved this way' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update domains
router.put('/:id/domains', async (req, res) => {
  // Check permission
  if (!req.adminAuth && !hasRight(req.currentUser, 'landings:domains')) {
    return res.status(403).json({ error: 'Missing permission: landings:domains' });
  }

  try {
    const { id } = req.params;
    const { domains } = req.body;
    const db = await readDB();

    const landing = db.landings.find(l => l.id === id);
    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    if (!Array.isArray(domains)) {
      return res.status(400).json({ error: 'Domains must be an array' });
    }

    const oldDomains = migrateDomains(landing.domains || []);
    const newDomains = domains.map(d => {
      if (typeof d === 'string') {
        const existing = oldDomains.find(od => od.domain === d);
        return { domain: d, published: existing ? existing.published : false };
      }
      return d;
    });

    const oldDomainStrings = oldDomains.map(d => d.domain);
    const newDomainStrings = newDomains.map(d => d.domain);
    console.log(`🌐 Updating domains for ${landing.name}: [${oldDomainStrings.join(', ')}] -> [${newDomainStrings.join(', ')}]`);

    landing.domains = newDomains;
    await writeDB(db);

    // Log audit event for domain changes
    const addedDomains = newDomainStrings.filter(d => !oldDomainStrings.includes(d));
    const removedDomains = oldDomainStrings.filter(d => !newDomainStrings.includes(d));

    if (addedDomains.length > 0) {
      await logAudit(id, {
        action: AUDIT_ACTIONS.DOMAIN_ADD,
        actor: req.currentUser?.email || 'admin',
        isAdmin: req.adminAuth,
        details: `Added domains: ${addedDomains.join(', ')}`,
        metadata: { domains: addedDomains }
      });
    }

    if (removedDomains.length > 0) {
      await logAudit(id, {
        action: AUDIT_ACTIONS.DOMAIN_REMOVE,
        actor: req.currentUser?.email || 'admin',
        isAdmin: req.adminAuth,
        details: `Removed domains: ${removedDomains.join(', ')}`,
        metadata: { domains: removedDomains }
      });
    }

    console.log(`✅ Domains updated successfully`);

    res.json({ success: true, landing });
  } catch (error) {
    console.error('❌ Error updating domains:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete landing
router.delete('/:id', async (req, res) => {
  // Check permission
  if (!req.adminAuth && !hasRight(req.currentUser, 'landings:delete')) {
    return res.status(403).json({ error: 'Missing permission: landings:delete' });
  }

  try {
    const { id } = req.params;
    const db = await readDB();
    
    const landingIndex = db.landings.findIndex(l => l.id === id);
    if (landingIndex === -1) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    const landing = db.landings[landingIndex];
    const landingDir = path.join(LANDINGS_DIR, landing.slug);
    
    console.log(`🗑️  Deleting landing: ${landing.name} (${landing.slug})`);

    if (landing.published) {
      try {
        await removeTraefikConfig(landing);
        console.log(`✅ Traefik config removed`);
      } catch (error) {
        console.error(`⚠️  Warning: Could not remove Traefik config:`, error.message);
      }
    }
    
    if (fs.existsSync(landingDir)) {
      fs.rmSync(landingDir, { recursive: true, force: true });
      console.log(`✅ Landing directory removed`);
    }

    // Delete all versions for this landing
    deleteAllVersions(landing.id);
    console.log(`✅ Landing versions removed`);

    // Delete audit log for this landing
    await deleteAuditLog(landing.id);
    console.log(`✅ Landing audit log removed`);

    db.landings.splice(landingIndex, 1);
    await writeDB(db);
    
    console.log(`✅ Landing deleted successfully`);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
