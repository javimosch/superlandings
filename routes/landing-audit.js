const express = require('express');
const { readDB } = require('../lib/store');
const { getAuditLogPaginated } = require('../lib/audit');
const { hasRight } = require('../lib/auth');

const router = express.Router({ mergeParams: true });

// Get audit log for a landing
router.get('/', async (req, res) => {
  // Check permission - require at least update permission to view audit
  if (!req.adminAuth && !hasRight(req.currentUser, 'landings:update')) {
    return res.status(403).json({ error: 'Missing permission: landings:update' });
  }

  try {
    const { id } = req.params;
    // parseInt returns NaN for non-numeric input; || fallback ensures safe defaults
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 50);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const db = await readDB();
    const landing = db.landings.find(l => l.id === id);

    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    const result = await getAuditLogPaginated(id, { limit, offset });

    res.json(result);
  } catch (error) {
    console.error('Error getting audit log:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
