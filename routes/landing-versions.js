const express = require('express');
const { readDB } = require('../lib/db');
const { hasRight } = require('../lib/auth');
const { 
  createVersion, 
  getVersions, 
  getVersion, 
  rollbackToVersion, 
  deleteVersion,
  getVersionContentPreview,
  getVersionFilesContent,
  getCurrentLandingFilesContent
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

    const version = createVersion(landing, description || '');
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

// Get diff between a version and the previous version (or current state)
router.get('/:versionId/diff', (req, res) => {
  try {
    const { id, versionId } = req.params;
    const { compareTo } = req.query; // 'previous' or 'current'
    const db = readDB();
    
    const landing = db.landings.find(l => l.id === id);
    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    const versions = getVersions(id);
    const versionIndex = versions.findIndex(v => v.id === versionId);
    
    if (versionIndex === -1) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const thisVersion = versions[versionIndex];
    const thisFiles = getVersionFilesContent(id, versionId);
    
    if (!thisFiles) {
      return res.status(404).json({ error: 'Version content not found' });
    }

    let compareFiles;
    let compareLabel;
    
    if (compareTo === 'current') {
      // Compare with current landing state
      compareFiles = getCurrentLandingFilesContent(landing);
      compareLabel = 'Current';
    } else {
      // Compare with previous version (next in array since sorted newest first)
      const prevVersion = versions[versionIndex + 1];
      if (!prevVersion) {
        return res.json({
          version: thisVersion,
          compareWith: null,
          compareLabel: 'No previous version',
          diffs: []
        });
      }
      compareFiles = getVersionFilesContent(id, prevVersion.id);
      compareLabel = `Version ${prevVersion.versionNumber || prevVersion.id}`;
    }

    // Compute diffs for each file
    const diffs = computeFileDiffs(thisFiles, compareFiles || {});

    res.json({
      version: thisVersion,
      compareLabel,
      diffs
    });
  } catch (error) {
    console.error('Error getting version diff:', error);
    res.status(500).json({ error: error.message });
  }
});

// Compute diffs between two file sets
function computeFileDiffs(newFiles, oldFiles) {
  const allFiles = new Set([...Object.keys(newFiles), ...Object.keys(oldFiles)]);
  const diffs = [];

  for (const filename of allFiles) {
    const newContent = newFiles[filename];
    const oldContent = oldFiles[filename];

    if (newContent === undefined) {
      // File was deleted
      diffs.push({
        filename,
        type: 'deleted',
        hunks: [{ oldStart: 1, oldLines: oldContent.split('\n'), newStart: 0, newLines: [] }]
      });
    } else if (oldContent === undefined) {
      // File was added
      diffs.push({
        filename,
        type: 'added',
        hunks: [{ oldStart: 0, oldLines: [], newStart: 1, newLines: newContent.split('\n') }]
      });
    } else if (newContent !== oldContent) {
      // File was modified
      const hunks = computeHunks(oldContent, newContent);
      if (hunks.length > 0) {
        diffs.push({
          filename,
          type: 'modified',
          hunks
        });
      }
    }
  }

  return diffs;
}

// Compute diff hunks using simple line-by-line comparison
function computeHunks(oldContent, newContent) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const hunks = [];
  
  // Simple LCS-based diff
  const lcs = computeLCS(oldLines, newLines);
  
  let oldIdx = 0;
  let newIdx = 0;
  let currentHunk = null;
  
  for (const match of lcs) {
    // Lines before match are changes
    if (oldIdx < match.oldIdx || newIdx < match.newIdx) {
      if (!currentHunk) {
        currentHunk = {
          oldStart: oldIdx + 1,
          newStart: newIdx + 1,
          changes: []
        };
      }
      
      // Add removed lines
      while (oldIdx < match.oldIdx) {
        currentHunk.changes.push({ type: 'remove', line: oldLines[oldIdx], lineNumber: oldIdx + 1 });
        oldIdx++;
      }
      
      // Add added lines
      while (newIdx < match.newIdx) {
        currentHunk.changes.push({ type: 'add', line: newLines[newIdx], lineNumber: newIdx + 1 });
        newIdx++;
      }
    }
    
    // Add context (matching line)
    if (currentHunk && currentHunk.changes.length > 0) {
      // Add some context lines
      currentHunk.changes.push({ type: 'context', line: oldLines[oldIdx], lineNumber: oldIdx + 1 });
      hunks.push(currentHunk);
      currentHunk = null;
    }
    
    oldIdx++;
    newIdx++;
  }
  
  // Handle remaining lines
  if (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (!currentHunk) {
      currentHunk = {
        oldStart: oldIdx + 1,
        newStart: newIdx + 1,
        changes: []
      };
    }
    
    while (oldIdx < oldLines.length) {
      currentHunk.changes.push({ type: 'remove', line: oldLines[oldIdx], lineNumber: oldIdx + 1 });
      oldIdx++;
    }
    
    while (newIdx < newLines.length) {
      currentHunk.changes.push({ type: 'add', line: newLines[newIdx], lineNumber: newIdx + 1 });
      newIdx++;
    }
    
    if (currentHunk.changes.length > 0) {
      hunks.push(currentHunk);
    }
  }
  
  return hunks;
}

// Compute Longest Common Subsequence for diff
function computeLCS(oldLines, newLines) {
  const m = oldLines.length;
  const n = newLines.length;
  
  // Build LCS table
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // Backtrack to find LCS
  const lcs = [];
  let i = m, j = n;
  
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      lcs.unshift({ oldIdx: i - 1, newIdx: j - 1, line: oldLines[i - 1] });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  
  return lcs;
}

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
