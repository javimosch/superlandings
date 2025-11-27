const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { DATA_DIR, LANDINGS_DIR } = require('./db');

// Versions directory
const VERSIONS_DIR = path.join(DATA_DIR, 'versions');

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
function getNextVersionNumber(landingId) {
  const versions = getVersions(landingId);
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
function createVersion(landing, description = '') {
  ensureVersionsDir();
  
  const landingDir = path.join(LANDINGS_DIR, landing.slug);
  if (!fs.existsSync(landingDir)) {
    return null;
  }

  const versionsDir = getLandingVersionsDir(landing.id);
  const versionId = Date.now().toString();
  const versionDir = path.join(versionsDir, versionId);
  fs.mkdirSync(versionDir, { recursive: true });

  // Get next version number
  const versionNumber = getNextVersionNumber(landing.id);

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
    createdAt: new Date().toISOString(),
    size: fs.statSync(zipPath).size
  };
  
  fs.writeFileSync(
    path.join(versionDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

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
function getVersions(landingId) {
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
function getVersion(landingId, versionId) {
  const metadataPath = path.join(VERSIONS_DIR, landingId, versionId, 'metadata.json');
  
  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
}

// Rollback to a specific version
function rollbackToVersion(landing, versionId) {
  const versionDir = path.join(VERSIONS_DIR, landing.id, versionId);
  const zipPath = path.join(versionDir, 'content.zip');
  
  if (!fs.existsSync(zipPath)) {
    throw new Error('Version content not found');
  }

  const landingDir = path.join(LANDINGS_DIR, landing.slug);
  
  // Create a backup of current state before rollback
  createVersion(landing, 'Backup before rollback');

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

  return true;
}

// Delete a specific version
function deleteVersion(landingId, versionId) {
  const versionDir = path.join(VERSIONS_DIR, landingId, versionId);
  
  if (fs.existsSync(versionDir)) {
    fs.rmSync(versionDir, { recursive: true });
    return true;
  }
  
  return false;
}

// Cleanup old versions, keeping only the most recent N
function cleanupOldVersions(landingId, keepCount = 10) {
  const versions = getVersions(landingId);
  
  if (versions.length <= keepCount) {
    return 0;
  }

  const toDelete = versions.slice(keepCount);
  let deleted = 0;
  
  for (const version of toDelete) {
    if (deleteVersion(landingId, version.id)) {
      deleted++;
    }
  }

  return deleted;
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
}

module.exports = {
  VERSIONS_DIR,
  ensureVersionsDir,
  createVersion,
  getVersions,
  getVersion,
  rollbackToVersion,
  deleteVersion,
  deleteAllVersions,
  getVersionContentPreview,
  getVersionFilesContent,
  getCurrentLandingFilesContent
};
