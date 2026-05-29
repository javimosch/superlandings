const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { DATA_DIR, LANDINGS_DIR, readDirectoryFilesSync } = require('./db');
const { readDB, writeDB, getEngine, getCollection } = require('./store');

// Versions directory
const VERSIONS_DIR = path.join(DATA_DIR, 'versions');
const CACHE_LANDINGS_DIR = path.join(DATA_DIR, 'landing-cache');

// Ensure versions directory exists
function ensureVersionsDir() {
  if (!fs.existsSync(VERSIONS_DIR)) {
    fs.mkdirSync(VERSIONS_DIR, { recursive: true });
  }
}

// Get versions directory for a landing
function getLandingVersionsDir(landingId) {
  const dir = path.join(VERSIONS_DIR, landingId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Get the next version number for a landing
async function getNextVersionNumber(landingId) {
  const versions = await getVersions(landingId);
  if (versions.length === 0) return 1;
  
  // Find the highest version number
  let maxNumber = 0;
  for (const v of versions) {
    if (v.versionNumber && v.versionNumber > maxNumber) {
      maxNumber = v.versionNumber;
    }
  }
  return maxNumber + 1;
}

// Create a version snapshot of a landing
async function createVersion(landing, description = '', auditId = null) {
  ensureVersionsDir();
  
  const landingDir = getLandingFsDir(landing);
  if (!fs.existsSync(landingDir)) {
    fs.mkdirSync(landingDir, { recursive: true });
  }

  // For mongo-backed HTML landings the on-disk cache can be cleared; rebuild it from stored content
  if (
    landing.type === 'html' &&
    typeof landing.content === 'string' &&
    !fs.existsSync(path.join(landingDir, 'index.html'))
  ) {
    fs.writeFileSync(path.join(landingDir, 'index.html'), landing.content);
  }

  if (!fs.existsSync(landingDir)) {
    return null;
  }

  let htmlContent = null;
  if (landing.type === 'html') {
    const indexPath = path.join(landingDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      htmlContent = fs.readFileSync(indexPath, 'utf-8');
    }
  }

  let filesContent = null;
  if (landing.type === 'virtual') {
    const landingDir = getLandingFsDir(landing);
    if (fs.existsSync(landingDir)) {
      filesContent = [];
      readDirectoryFilesSync(landingDir, '', filesContent);
    }
  }

  const versionsDir = getLandingVersionsDir(landing.id);
  const versionId = Date.now().toString();
  const versionDir = path.join(versionsDir, versionId);
  fs.mkdirSync(versionDir, { recursive: true });

  // Get next version number
  const versionNumber = await getNextVersionNumber(landing.id);

  // Create zip of current landing content
  const zip = new AdmZip();
  addDirectoryToZip(zip, landingDir, '');
  const zipPath = path.join(versionDir, 'content.zip');
  zip.writeZip(zipPath);

  // Save version metadata
  const metadata = {
    id: versionId,
    landingId: landing.id,
    landingSlug: landing.slug,
    landingType: landing.type,
    versionNumber,
    description: description || '',
    tag: null, // Initialize tag as null
    createdAt: new Date().toISOString(),
    size: fs.statSync(zipPath).size,
    auditId: auditId || null // Link to audit record if provided
  };
  
  if (getEngine() === 'mongo') {
    const col = await getCollection('versions');
    await col.updateOne(
      { _id: `${landing.id}:${versionId}` },
      { $set: { ...metadata, content: htmlContent, files: filesContent, _id: `${landing.id}:${versionId}` } },
      { upsert: true }
    );
  } else {
    fs.writeFileSync(
      path.join(versionDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
  }

  // Cleanup old versions (keep last 10)
  cleanupOldVersions(landing.id, 10);

  return metadata;
}

// Recursively add directory contents to zip
function addDirectoryToZip(zip, dirPath, zipPath) {
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const itemZipPath = zipPath ? `${zipPath}/${item}` : item;
    
    if (fs.statSync(fullPath).isDirectory()) {
      addDirectoryToZip(zip, fullPath, itemZipPath);
    } else {
      zip.addLocalFile(fullPath, zipPath || undefined);
    }
  }
}

// Get all versions for a landing
async function getVersions(landingId) {
  if (getEngine() === 'mongo') {
    const col = await getCollection('versions');
    const docs = await col
      .find({ landingId }, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    return docs || [];
  }

  ensureVersionsDir();
  const versionsDir = path.join(VERSIONS_DIR, landingId);
  
  if (!fs.existsSync(versionsDir)) {
    return [];
  }

  const versions = [];
  const versionDirs = fs.readdirSync(versionsDir);
  
  for (const versionId of versionDirs) {
    const metadataPath = path.join(versionsDir, versionId, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        versions.push(metadata);
      } catch (e) {
        console.error(`Error reading version metadata: ${metadataPath}`, e);
      }
    }
  }

  // Sort by creation date, newest first
  versions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return versions;
}

// Get a specific version
async function getVersion(landingId, versionId) {
  if (getEngine() === 'mongo') {
    const col = await getCollection('versions');
    const doc = await col.findOne({ _id: `${landingId}:${versionId}` }, { projection: { _id: 0 } });
    return doc || null;
  }

  const metadataPath = path.join(VERSIONS_DIR, landingId, versionId, 'metadata.json');
  
  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
}

// Rollback to a specific version
async function rollbackToVersion(landing, versionId) {
  const versionDir = path.join(VERSIONS_DIR, landing.id, versionId);
  const zipPath = path.join(versionDir, 'content.zip');
  
  if (!fs.existsSync(zipPath)) {
    if (getEngine() === 'mongo') {
      const version = await getVersion(landing.id, versionId);
      if (version && landing.type === 'html' && typeof version.content === 'string') {
        const landingDir = path.join(LANDINGS_DIR, landing.slug);
        fs.mkdirSync(landingDir, { recursive: true });
        fs.writeFileSync(path.join(landingDir, 'index.html'), version.content);

        const db = await readDB();
        const landingIndex = db.landings.findIndex(l => l.id === landing.id);
        if (landingIndex !== -1) {
          db.landings[landingIndex].currentVersionId = version.id;
          db.landings[landingIndex].currentVersionNumber = version.versionNumber;
          db.landings[landingIndex].content = version.content;
          await writeDB(db);
        }

        return true;
      } else if (version && landing.type === 'virtual' && Array.isArray(version.files)) {
        const landingDir = path.join(LANDINGS_DIR, landing.slug);
        fs.mkdirSync(landingDir, { recursive: true });
        
        // Clear landing dir first
        if (fs.existsSync(landingDir)) {
          fs.rmSync(landingDir, { recursive: true, force: true });
        }
        fs.mkdirSync(landingDir, { recursive: true });

        for (const file of version.files) {
          const filePath = path.join(landingDir, file.path);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, file.content);
        }

        const db = await readDB();
        const landingIndex = db.landings.findIndex(l => l.id === landing.id);
        if (landingIndex !== -1) {
          db.landings[landingIndex].currentVersionId = version.id;
          db.landings[landingIndex].currentVersionNumber = version.versionNumber;
          db.landings[landingIndex].files = version.files;
          await writeDB(db);
        }

        return true;
      }
    }
    throw new Error('Version content not found');
  }

  const landingDir = path.join(LANDINGS_DIR, landing.slug);
  
  // Create a backup of current state before rollback
  await createVersion(landing, 'Backup before rollback');

  // Clear current landing directory
  if (fs.existsSync(landingDir)) {
    const files = fs.readdirSync(landingDir);
    for (const file of files) {
      const filePath = path.join(landingDir, file);
      if (fs.statSync(filePath).isDirectory()) {
        fs.rmSync(filePath, { recursive: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }
  } else {
    fs.mkdirSync(landingDir, { recursive: true });
  }

  // Extract version content
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(landingDir, true);

  // Get the version metadata to update the landing's current version
  const version = await getVersion(landing.id, versionId);
  if (version) {
    // Update landing to point to the rolled-back version
    const db = await readDB();
    const landingIndex = db.landings.findIndex(l => l.id === landing.id);
    if (landingIndex !== -1) {
      db.landings[landingIndex].currentVersionId = version.id;
      db.landings[landingIndex].currentVersionNumber = version.versionNumber;
      await writeDB(db);
    }
  }

  return true;
}

// Restore a version's content to disk without creating backups or new versions
async function restoreVersionToDisk(landing, versionId) {
  const versionDir = path.join(VERSIONS_DIR, landing.id, versionId);
  const zipPath = path.join(versionDir, 'content.zip');

  if (!fs.existsSync(zipPath)) {
    if (getEngine() === 'mongo') {
      const version = await getVersion(landing.id, versionId);
      if (version && landing.type === 'html' && typeof version.content === 'string') {
        const landingDir = path.join(LANDINGS_DIR, landing.slug);
        fs.mkdirSync(landingDir, { recursive: true });
        fs.writeFileSync(path.join(landingDir, 'index.html'), version.content);
        return true;
      } else if (version && landing.type === 'virtual' && Array.isArray(version.files)) {
        const landingDir = path.join(LANDINGS_DIR, landing.slug);
        fs.mkdirSync(landingDir, { recursive: true });
        // Clear landing dir first
        if (fs.existsSync(landingDir)) {
          fs.rmSync(landingDir, { recursive: true, force: true });
        }
        fs.mkdirSync(landingDir, { recursive: true });

        for (const file of version.files) {
          const filePath = path.join(landingDir, file.path);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, file.content);
        }
        return true;
      }
    }

    console.warn(`⚠️  Version zip missing for ${landing.slug} v${versionId}`);
    return false;
  }

  const landingDir = path.join(LANDINGS_DIR, landing.slug);
  fs.mkdirSync(landingDir, { recursive: true });

  // Clear current landing directory
  if (fs.existsSync(landingDir)) {
    fs.rmSync(landingDir, { recursive: true, force: true });
  }

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(landingDir, true);
  return true;
}

// Delete a specific version
async function deleteVersion(landingId, versionId) {
  const version = await getVersion(landingId, versionId);
  
  // Prevent deletion of tagged versions
  if (version && version.tag) {
    throw new Error(`Cannot delete version "${version.tag}" - tagged versions are protected from deletion`);
  }
  
  const versionDir = path.join(VERSIONS_DIR, landingId, versionId);
  let deleted = false;

  if (fs.existsSync(versionDir)) {
    fs.rmSync(versionDir, { recursive: true });
    deleted = true;
  }

  if (getEngine() === 'mongo') {
    const col = await getCollection('versions');
    const result = await col.deleteOne({ _id: `${landingId}:${versionId}` });
    if (result.deletedCount > 0) deleted = true;
  }

  return deleted;
}

// Update version metadata (description and tag)
async function updateVersionMetadata(landingId, versionId, updates) {
  if (getEngine() === 'mongo') {
    const col = await getCollection('versions');
    const updateSet = {};
    if (updates.description !== undefined) updateSet.description = updates.description;
    if (updates.tag !== undefined) updateSet.tag = updates.tag;
    updateSet.updatedAt = new Date().toISOString();

    const res = await col.findOneAndUpdate(
      { _id: `${landingId}:${versionId}` },
      { $set: updateSet },
      { returnDocument: 'after', projection: { _id: 0 } }
    );

    // MongoDB driver v4+ returns the document directly (not { value: doc })
    if (!res) {
      throw new Error('Version not found');
    }

    return res;
  }

  const metadataPath = path.join(VERSIONS_DIR, landingId, versionId, 'metadata.json');
  
  if (!fs.existsSync(metadataPath)) {
    throw new Error('Version not found');
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    
    // Update allowed fields
    if (updates.description !== undefined) {
      metadata.description = updates.description;
    }
    if (updates.tag !== undefined) {
      metadata.tag = updates.tag;
    }
    
    // Update modified timestamp
    metadata.updatedAt = new Date().toISOString();
    
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    return metadata;
  } catch (e) {
    throw new Error('Failed to update version metadata: ' + e.message);
  }
}

// Cleanup old versions (keep all versions, no automatic deletion)
function cleanupOldVersions(landingId, keepCount = Infinity) {
  // No automatic cleanup - keep all versions
  // Tagged versions are always protected
  // This function is kept for compatibility but no longer deletes versions
  return 0;
}

// Delete all versions for a landing (when landing is deleted)
function deleteAllVersions(landingId) {
  const versionsDir = path.join(VERSIONS_DIR, landingId);
  
  if (fs.existsSync(versionsDir)) {
    fs.rmSync(versionsDir, { recursive: true });
    return true;
  }
  
  return false;
}

// Get version content preview (for HTML landings)
function getVersionContentPreview(landingId, versionId) {
  const versionDir = path.join(VERSIONS_DIR, landingId, versionId);
  const zipPath = path.join(versionDir, 'content.zip');
  
  if (!fs.existsSync(zipPath)) {
    return null;
  }

  const zip = new AdmZip(zipPath);
  const indexEntry = zip.getEntry('index.html');
  
  if (indexEntry) {
    return zip.readAsText(indexEntry);
  }
  
  return null;
}

// Get all files content from a version (for diff)
function getVersionFilesContent(landingId, versionId) {
  const versionDir = path.join(VERSIONS_DIR, landingId, versionId);
  const zipPath = path.join(versionDir, 'content.zip');
  
  if (!fs.existsSync(zipPath)) {
    return null;
  }

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const files = {};
  
  for (const entry of entries) {
    if (!entry.isDirectory) {
      try {
        files[entry.entryName] = zip.readAsText(entry);
      } catch (e) {
        files[entry.entryName] = '[Binary file]';
      }
    }
  }
  
  return files;
}

// Get current landing files content (for diff with current state)
function getCurrentLandingFilesContent(landing) {
  const landingDir = path.join(LANDINGS_DIR, landing.slug);
  
  if (!fs.existsSync(landingDir)) {
    return {};
  }

  const files = {};
  readDirectoryFiles(landingDir, '', files);
  return files;
}

// Recursively read directory files
function readDirectoryFiles(dirPath, prefix, files) {
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const relativePath = prefix ? `${prefix}/${item}` : item;
    
    if (fs.statSync(fullPath).isDirectory()) {
      readDirectoryFiles(fullPath, relativePath, files);
    } else {
      try {
        files[relativePath] = fs.readFileSync(fullPath, 'utf-8');
      } catch (e) {
        files[relativePath] = '[Binary file]';
      }
    }
  }
  return true;
}

// Remove cached landing files (filesystem) for a landing slug (mongo mode cache)
function clearLandingCache(slug) {
  const landingDir = path.join(getCacheRoot(), slug);
  if (fs.existsSync(landingDir)) {
    fs.rmSync(landingDir, { recursive: true, force: true });
    return true;
  }
  return false;
}

function getCacheRoot() {
  return CACHE_LANDINGS_DIR;
}

function getLandingFsDir(landing) {
  if (getEngine() === 'mongo' && landing && (landing.type === 'html' || landing.type === 'virtual')) {
    return path.join(CACHE_LANDINGS_DIR, landing.slug);
  }
  return path.join(LANDINGS_DIR, landing.slug);
}

module.exports = {
  VERSIONS_DIR,
  ensureVersionsDir,
  createVersion,
  getVersions,
  getVersion,
  rollbackToVersion,
  restoreVersionToDisk,
  clearLandingCache,
  deleteVersion,
  deleteAllVersions,
  updateVersionMetadata,
  getVersionContentPreview,
  getVersionFilesContent,
  getCurrentLandingFilesContent,
  getLandingFsDir,
  getCacheRoot
};
