const fs = require('fs');
const path = require('path');

// Paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const LANDINGS_DIR = path.join(DATA_DIR, 'landings');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure directories exist
function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(LANDINGS_DIR)) fs.mkdirSync(LANDINGS_DIR);
  const uploadDir = path.join(DATA_DIR, 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ landings: [] }, null, 2));
  }
}

// Database read/write
function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Domain helpers
function migrateDomains(domains) {
  if (!domains) return [];
  if (domains.length === 0) return [];
  if (domains[0] != null && typeof domains[0] === 'object' && domains[0].hasOwnProperty('domain')) {
    return domains;
  }
  return domains.map(d => ({ domain: d, published: false }));
}

function getPublishedDomains(domains) {
  const migratedDomains = migrateDomains(domains);
  return migratedDomains.filter(d => d.published).map(d => d.domain);
}

function getAllDomainStrings(domains) {
  const migratedDomains = migrateDomains(domains);
  return migratedDomains.map(d => d.domain);
}

function readDirectoryFilesSync(dirPath, prefix, files) {
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    // Ensure virtual path uses forward slashes and relative to the landing root
    const relativePath = prefix ? `${prefix}/${item}` : item;
    if (fs.statSync(fullPath).isDirectory()) {
      readDirectoryFilesSync(fullPath, relativePath, files);
    } else {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        files.push({
          path: relativePath,
          content,
          size: fs.statSync(fullPath).size
        });
      } catch (e) {
        // Skip binary files for DB storage
      }
    }
  }
}

module.exports = {
  DATA_DIR,
  LANDINGS_DIR,
  DB_FILE,
  ensureDirectories,
  readDB,
  writeDB,
  migrateDomains,
  getPublishedDomains,
  getAllDomainStrings,
  readDirectoryFilesSync
};
