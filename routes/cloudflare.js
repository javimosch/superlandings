const express = require('express');
const { readDB, writeDB } = require('../lib/store');
const { hasRight } = require('../lib/auth');
const { isCloudflareEnabled, verifyCloudflareToken, configureDnsForDomain } = require('../lib/cloudflare');
const { logAudit, AUDIT_ACTIONS } = require('../lib/audit');

const router = express.Router();

function requireCloudflareEnabled(req, res, next) {
  if (!isCloudflareEnabled()) {
    return res.status(400).json({ error: 'Cloudflare integration is not enabled. Missing CLOUDFLARE_API_TOKEN in env.' });
  }
  next();
}

function getActor(req) {
  return req.currentUser?.email || (req.adminAuth ? 'admin' : 'unknown');
}

// Get Cloudflare status for current user
router.get('/status', async (req, res) => {
  const adminConnected = !!req.adminAuth; // admins are allowed to run DNS without per-user connect
  res.json({
    enabled: isCloudflareEnabled(),
    connected: adminConnected || !!req.currentUser?.cloudflareConnectedAt,
    connectedAt: adminConnected ? new Date().toISOString() : (req.currentUser?.cloudflareConnectedAt || null),
    email: req.currentUser?.cloudflareEmail || null
  });
});

// Connect Cloudflare (env token is used; this is a per-user enable switch)
router.post('/connect', requireCloudflareEnabled, async (req, res) => {
  try {
    if (req.adminAuth) {
      return res.status(400).json({ error: 'Admin session cannot connect Cloudflare. Use a user account.' });
    }

    await verifyCloudflareToken();

    const { email } = req.body || {};

    const db = await readDB();
    const users = db.users || [];
    const user = users.find(u => u.email === req.currentUser?.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.cloudflareConnectedAt = new Date().toISOString();
    if (email && String(email).trim()) {
      user.cloudflareEmail = String(email).trim();
    }

    await writeDB(db);

    req.session.user = user;

    await logAudit('cloudflare', {
      action: AUDIT_ACTIONS.CLOUDFLARE_CONNECT,
      actor: getActor(req),
      isAdmin: req.adminAuth,
      details: 'Connected Cloudflare',
      metadata: { email: user.cloudflareEmail || null }
    });

    res.json({
      success: true,
      connectedAt: user.cloudflareConnectedAt,
      email: user.cloudflareEmail || null
    });
  } catch (error) {
    console.error('❌ Error connecting Cloudflare:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/disconnect', requireCloudflareEnabled, async (req, res) => {
  try {
    if (req.adminAuth) {
      return res.status(400).json({ error: 'Admin session cannot disconnect Cloudflare. Use a user account.' });
    }

    const db = await readDB();
    const users = db.users || [];
    const user = users.find(u => u.email === req.currentUser?.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.cloudflareConnectedAt = null;
    user.cloudflareEmail = null;

    await writeDB(db);
    req.session.user = user;

    await logAudit('cloudflare', {
      action: AUDIT_ACTIONS.CLOUDFLARE_DISCONNECT,
      actor: getActor(req),
      isAdmin: req.adminAuth,
      details: 'Disconnected Cloudflare'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error disconnecting Cloudflare:', error);
    res.status(500).json({ error: error.message });
  }
});

// Configure DNS for an arbitrary domain
router.post('/dns/configure', requireCloudflareEnabled, async (req, res) => {
  try {
    if (!req.adminAuth && !hasRight(req.currentUser, 'landings:domains')) {
      return res.status(403).json({ error: 'Missing permission: landings:domains' });
    }

    if (!req.adminAuth && !req.currentUser?.cloudflareConnectedAt) {
      return res.status(403).json({ error: 'Cloudflare is not connected for this user' });
    }

    const { domain } = req.body || {};
    if (!domain || !String(domain).trim()) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    const result = await configureDnsForDomain(domain);

    await logAudit('cloudflare', {
      action: AUDIT_ACTIONS.CLOUDFLARE_DNS_CONFIGURE,
      actor: getActor(req),
      isAdmin: req.adminAuth,
      details: `Configured DNS for ${String(domain).trim()}`,
      metadata: {
        domain: String(domain).trim(),
        zone: result.zone?.name,
        targetIp: result.targetIp,
        removedCount: result.removed?.length || 0,
        addedCount: result.added?.length || 0,
        skippedCount: result.skipped?.length || 0
      }
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Error configuring Cloudflare DNS:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
