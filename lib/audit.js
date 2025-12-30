const fs = require('fs');
const path = require('path');
const { getEngine, getCollection } = require('./store');

const DATA_DIR = path.join(__dirname, '..', 'data');
const AUDIT_DIR = path.join(DATA_DIR, 'audit');

// Ensure audit directory exists
function ensureAuditDir() {
  if (!fs.existsSync(AUDIT_DIR)) {
    fs.mkdirSync(AUDIT_DIR, { recursive: true });
  }
}

// Get audit file path for a landing
function getAuditFilePath(landingId) {
  return path.join(AUDIT_DIR, `${landingId}.json`);
}

// Read audit log for a landing
async function getAuditLog(landingId) {
  if (getEngine() === 'mongo') {
    const col = await getCollection('audit');
    const doc = await col.findOne({ _id: landingId });
    return doc && Array.isArray(doc.entries) ? doc.entries : [];
  }

  ensureAuditDir();
  const filePath = getAuditFilePath(landingId);
  
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`Error reading audit log for ${landingId}:`, err);
    return [];
  }
}

// Write audit log for a landing
async function writeAuditLog(landingId, entries) {
  if (getEngine() === 'mongo') {
    const col = await getCollection('audit');
    await col.updateOne(
      { _id: landingId },
      { $set: { entries, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    return;
  }

  ensureAuditDir();
  const filePath = getAuditFilePath(landingId);
  fs.writeFileSync(filePath, JSON.stringify(entries, null, 2));
}

/**
 * Log an audit event
 * @param {string} landingId - The landing ID
 * @param {object} options - Audit event options
 * @param {string} options.action - Action type (create, update, delete, publish, unpublish, rollback, etc.)
 * @param {string} options.actor - Who performed the action (email or 'admin')
 * @param {boolean} options.isAdmin - Whether the actor is an admin
 * @param {string} [options.details] - Additional details about the action
 * @param {object} [options.metadata] - Any additional metadata
 * @param {array} [options.versionIds] - Array of version IDs linked to this action (e.g., before/after snapshots)
 */
async function logAudit(landingId, { action, actor, isAdmin, details, metadata, versionIds }) {
  const entries = await getAuditLog(landingId);
  
  const entry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    action,
    actor,
    isAdmin: !!isAdmin,
    details: details || null,
    metadata: metadata || null,
    versionIds: versionIds && versionIds.length > 0 ? versionIds : null
  };
  
  // Add to beginning (newest first)
  entries.unshift(entry);
  
  // Keep only last 500 entries per landing
  const trimmedEntries = entries.slice(0, 500);
  
  await writeAuditLog(landingId, trimmedEntries);
  
  return entry;
}

/**
 * Get audit log with pagination
 * @param {string} landingId - The landing ID
 * @param {object} options - Pagination options
 * @param {number} [options.limit=50] - Number of entries to return
 * @param {number} [options.offset=0] - Offset for pagination
 * @returns {object} - { entries, total, hasMore }
 */
async function getAuditLogPaginated(landingId, { limit = 50, offset = 0 } = {}) {
  const entries = await getAuditLog(landingId);
  const total = entries.length;
  const paginatedEntries = entries.slice(offset, offset + limit);
  
  return {
    entries: paginatedEntries,
    total,
    hasMore: offset + limit < total
  };
}

/**
 * Delete audit log for a landing (when landing is deleted)
 * @param {string} landingId - The landing ID
 */
async function deleteAuditLog(landingId) {
  if (getEngine() === 'mongo') {
    const col = await getCollection('audit');
    await col.deleteOne({ _id: landingId });
    return;
  }

  const filePath = getAuditFilePath(landingId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// Action type constants
const AUDIT_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  PUBLISH: 'publish',
  UNPUBLISH: 'unpublish',
  ROLLBACK: 'rollback',
  VERSION_CREATE: 'version_create',
  VERSION_DELETE: 'version_delete',
  VERSION_TAG: 'version_tag',
  VERSION_UNTAG: 'version_untag',
  DOMAIN_ADD: 'domain_add',
  DOMAIN_REMOVE: 'domain_remove',
  DOMAIN_PUBLISH: 'domain_publish',
  DOMAIN_UNPUBLISH: 'domain_unpublish',
  MOVE: 'move'
};

module.exports = {
  logAudit,
  getAuditLog,
  getAuditLogPaginated,
  deleteAuditLog,
  AUDIT_ACTIONS
};
