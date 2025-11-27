const express = require('express');
const { readDB, writeDB } = require('../lib/db');

const router = express.Router();

// Get all organizations (admin only)
router.get('/', (req, res) => {
  if (!req.adminAuth) {
    // Return only user's organizations
    return res.json(req.userOrganizations || []);
  }
  
  const db = readDB();
  res.json(db.organizations || []);
});

// Get single organization
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const orgs = db.organizations || [];
  const org = orgs.find(o => o.id === id);
  
  if (!org) {
    return res.status(404).json({ error: 'Organization not found' });
  }

  // Check access
  if (!req.adminAuth) {
    const hasAccess = org.users && org.users.some(u => u.email === req.currentUser?.email);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  res.json(org);
});

// Create organization (admin only)
router.post('/', (req, res) => {
  if (!req.adminAuth) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const db = readDB();
    if (!db.organizations) db.organizations = [];

    const org = {
      id: Date.now().toString(),
      name: name.trim(),
      users: [],
      createdAt: new Date().toISOString()
    };

    db.organizations.push(org);
    writeDB(db);

    console.log(`✅ Organization created: ${org.name}`);
    res.json(org);
  } catch (error) {
    console.error('❌ Error creating organization:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update organization (admin only)
router.put('/:id', (req, res) => {
  if (!req.adminAuth) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const db = readDB();
    const orgs = db.organizations || [];
    const org = orgs.find(o => o.id === id);
    
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    org.name = name.trim();
    writeDB(db);

    console.log(`✅ Organization updated: ${org.name}`);
    res.json(org);
  } catch (error) {
    console.error('❌ Error updating organization:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete organization (admin only)
router.delete('/:id', (req, res) => {
  if (!req.adminAuth) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { id } = req.params;
    const db = readDB();
    
    // Check if organization has landings
    const landings = db.landings || [];
    const orgLandings = landings.filter(l => l.organizationId === id);
    
    if (orgLandings.length > 0) {
      return res.status(400).json({ 
        error: `Cannot delete organization with ${orgLandings.length} landing(s). Move or delete landings first.` 
      });
    }

    const orgs = db.organizations || [];
    const index = orgs.findIndex(o => o.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const deleted = orgs.splice(index, 1)[0];
    writeDB(db);

    console.log(`✅ Organization deleted: ${deleted.name}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting organization:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add user to organization (admin only)
router.post('/:id/users', (req, res) => {
  if (!req.adminAuth) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { id } = req.params;
    const { email, rights } = req.body;
    
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const db = readDB();
    const orgs = db.organizations || [];
    const org = orgs.find(o => o.id === id);
    
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check if user exists
    const users = db.users || [];
    const user = users.find(u => u.email === email.trim());
    if (!user) {
      return res.status(400).json({ error: 'User not found. Create the user first.' });
    }

    if (!org.users) org.users = [];
    
    // Check if already added
    if (org.users.some(u => u.email === email.trim())) {
      return res.status(400).json({ error: 'User already in organization' });
    }

    org.users.push({
      email: email.trim(),
      rights: rights || []
    });

    writeDB(db);

    console.log(`✅ User ${email} added to organization ${org.name}`);
    res.json(org);
  } catch (error) {
    console.error('❌ Error adding user to organization:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user rights in organization (admin only)
router.put('/:id/users/:email', (req, res) => {
  if (!req.adminAuth) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { id, email } = req.params;
    const { rights } = req.body;

    const db = readDB();
    const orgs = db.organizations || [];
    const org = orgs.find(o => o.id === id);
    
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const userInOrg = org.users?.find(u => u.email === email);
    if (!userInOrg) {
      return res.status(404).json({ error: 'User not found in organization' });
    }

    userInOrg.rights = rights || [];
    writeDB(db);

    console.log(`✅ User ${email} rights updated in organization ${org.name}`);
    res.json(org);
  } catch (error) {
    console.error('❌ Error updating user rights:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove user from organization (admin only)
router.delete('/:id/users/:email', (req, res) => {
  if (!req.adminAuth) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { id, email } = req.params;

    const db = readDB();
    const orgs = db.organizations || [];
    const org = orgs.find(o => o.id === id);
    
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!org.users) {
      return res.status(404).json({ error: 'User not found in organization' });
    }

    const index = org.users.findIndex(u => u.email === email);
    if (index === -1) {
      return res.status(404).json({ error: 'User not found in organization' });
    }

    org.users.splice(index, 1);
    writeDB(db);

    console.log(`✅ User ${email} removed from organization ${org.name}`);
    res.json(org);
  } catch (error) {
    console.error('❌ Error removing user from organization:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
