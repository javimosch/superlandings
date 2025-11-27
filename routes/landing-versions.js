const express = require('express');
const { readDB } = require('../lib/db');
const { hasRight } = require('../lib/auth');
const { 
  createVersion, 
  getVersions, 
  getVersion, 
  rollbackToVersion, 
  deleteVersion,
  getVersionContentPreview 
} = require('../lib/versions');

const router = express.Router({ mergeParams: true });

// Get all versions for a landing
router.get('/', (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    
    const landing = db.landings.find(l => l.id === id);
    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    const versions = getVersions(id);
    res.json(versions);
  } catch (error) {
    console.error('Error getting versions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a manual version snapshot
router.post('/', (req, res) => {
  // Check permission
  if (!req.adminAuth && !hasRight(req.currentUser, 'landings:update')) {
    return res.status(403).json({ error: 'Missing permission: landings:update' });
  }

  try {
    const { id } = req.params;
    const { description } = req.body;
    const db = readDB();
    
    const landing = db.landings.find(l => l.id === id);
    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    const version = createVersion(landing, description || 'Manual snapshot');
    if (!version) {
      return res.status(400).json({ error: 'Could not create version' });
    }

    res.json(version);
  } catch (error) {
    console.error('Error creating version:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a specific version
router.get('/:versionId', (req, res) => {
  try {
    const { id, versionId } = req.params;
    
    const version = getVersion(id, versionId);
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json(version);
  } catch (error) {
    console.error('Error getting version:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get version content preview (HTML only)
router.get('/:versionId/preview', (req, res) => {
  try {
    const { id, versionId } = req.params;
    
    const content = getVersionContentPreview(id, versionId);
    if (content === null) {
      return res.status(404).json({ error: 'Version content not found or not HTML' });
    }

    res.json({ content });
  } catch (error) {
    console.error('Error getting version preview:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rollback to a specific version
router.post('/:versionId/rollback', (req, res) => {
  // Check permission
  if (!req.adminAuth && !hasRight(req.currentUser, 'landings:update')) {
    return res.status(403).json({ error: 'Missing permission: landings:update' });
  }

  try {
    const { id, versionId } = req.params;
    const db = readDB();
    
    const landing = db.landings.find(l => l.id === id);
    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    const version = getVersion(id, versionId);
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    rollbackToVersion(landing, versionId);
    
    console.log(`🔄 Rolled back landing "${landing.name}" to version ${versionId}`);

    res.json({ 
      success: true, 
      message: `Rolled back to version from ${new Date(version.createdAt).toLocaleString()}`
    });
  } catch (error) {
    console.error('Error rolling back version:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a specific version
router.delete('/:versionId', (req, res) => {
  // Check permission
  if (!req.adminAuth && !hasRight(req.currentUser, 'landings:update')) {
    return res.status(403).json({ error: 'Missing permission: landings:update' });
  }

  try {
    const { id, versionId } = req.params;
    
    const deleted = deleteVersion(id, versionId);
    if (!deleted) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting version:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
