const { readDB, writeDB } = require('./db');
const { createVersion, getVersions } = require('./versions');

// Migration script to add version tracking to existing landings
function migrateExistingLandings() {
  console.log('🔄 Starting version migration for existing landings...');
  
  const db = readDB();
  const landings = db.landings || [];
  let migratedCount = 0;
  
  for (const landing of landings) {
    // Skip if already has version tracking
    if (landing.currentVersionId && landing.currentVersionNumber) {
      console.log(`⏭️  Skipping "${landing.name}" - already has version tracking`);
      continue;
    }
    
    // Check if versions already exist
    const existingVersions = getVersions(landing.id);
    
    if (existingVersions.length > 0) {
      // Use the latest version as current
      const latestVersion = existingVersions[0]; // Versions are sorted newest first
      landing.currentVersionId = latestVersion.id;
      landing.currentVersionNumber = latestVersion.versionNumber;
      console.log(`📝 Updated "${landing.name}" to point to existing version ${latestVersion.versionNumber}`);
    } else {
      // Create initial version
      try {
        const initialVersion = createVersion(landing, 'Initial version - migration');
        landing.currentVersionId = initialVersion.id;
        landing.currentVersionNumber = initialVersion.versionNumber;
        console.log(`🆕 Created initial version for "${landing.name}" - v${initialVersion.versionNumber}`);
      } catch (error) {
        console.error(`❌ Failed to create version for "${landing.name}":`, error.message);
        // Set default values even if version creation fails
        landing.currentVersionId = null;
        landing.currentVersionNumber = null;
      }
    }
    
    migratedCount++;
  }
  
  // Write updated database
  writeDB(db);
  
  console.log(`✅ Migration completed. ${migratedCount} landings processed.`);
  return migratedCount;
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateExistingLandings();
}

module.exports = { migrateExistingLandings };
