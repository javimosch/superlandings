const express = require('express');
const { readDB, writeDB } = require('../lib/store');
const { hashPassword, AVAILABLE_RIGHTS } = require('../lib/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/', async (req, res) => {
  if (!req.adminAuth) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const db = await readDB();
  const users = (db.users || []).map(u => ({
    ...u,
    password: undefined // Never expose password
  }));
  res.json(users);
});

// Get available rights
router.get('/rights', (req, res) => {
  res.json(AVAILABLE_RIGHTS);
});

// Get single user (admin only)
router.get('/:email', async (req, res) => {
  if (!req.adminAuth) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { email } = req.params;
  const db = await readDB();
  const users = db.users || [];
  const user = users.find(u => u.email === email);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ ...user, password: undefined });
});

// Create user (admin only)
router.post('/', async (req, res) => {
  if (!req.adminAuth) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { email, password } = req.body;
    
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!password || password.length < 3) {
      return res.status(400).json({ error: 'Password must be at least 3 characters' });
    }

    const db = await readDB();
    if (!db.users) db.users = [];

    // Check if email exists
    if (db.users.some(u => u.email === email.trim())) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const user = {
      email: email.trim(),
      password: hashPassword(password),
      createdAt: new Date().toISOString()
    };

    db.users.push(user);
    await writeDB(db);

    console.log(`✅ User created: ${user.email}`);
    res.json({ ...user, password: undefined });
  } catch (error) {
    console.error('❌ Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user (admin only)
router.put('/:email', async (req, res) => {
  if (!req.adminAuth) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { email } = req.params;
    const { newEmail, password } = req.body;

    const db = await readDB();
    const users = db.users || [];
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (newEmail && newEmail.trim() !== email) {
      // Check if new email exists
      if (users.some(u => u.email === newEmail.trim())) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
      
      // Update email in all organizations
      const orgs = db.organizations || [];
      orgs.forEach(org => {
        if (org.users) {
          const userInOrg = org.users.find(u => u.email === email);
          if (userInOrg) {
            userInOrg.email = newEmail.trim();
          }
        }
      });

      user.email = newEmail.trim();
    }

    if (password && password.length >= 3) {
      user.password = hashPassword(password);
    }

    await writeDB(db);

    console.log(`✅ User updated: ${user.email}`);
    res.json({ ...user, password: undefined });
  } catch (error) {
    console.error('❌ Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete user (admin only)
router.delete('/:email', async (req, res) => {
  if (!req.adminAuth) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { email } = req.params;
    const db = await readDB();
    
    const users = db.users || [];
    const index = users.findIndex(u => u.email === email);
    
    if (index === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove from all organizations
    const orgs = db.organizations || [];
    orgs.forEach(org => {
      if (org.users) {
        org.users = org.users.filter(u => u.email !== email);
      }
    });

    users.splice(index, 1);
    await writeDB(db);

    console.log(`✅ User deleted: ${email}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
