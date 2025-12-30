const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const { readDB: readJsonDB, writeDB: writeJsonDB, DATA_DIR } = require('./db');

let mongoClient = null;
let mongoDb = null;

function getEngine() {
  return (process.env.PERSISTENCE_ENGINE || 'json').toLowerCase();
}

async function getLandings() {
  if (getEngine() !== 'mongo') {
    const db = readJsonDB();
    return db.landings || [];
  }

  await connectMongo();
  return mongoDb
    .collection('landings')
    .find({}, { projection: { _id: 0 } })
    .toArray();
}

async function replaceLandings(landings) {
  if (getEngine() !== 'mongo') {
    const db = readJsonDB();
    db.landings = landings || [];
    writeJsonDB(db);
    return;
  }

  await connectMongo();
  const col = mongoDb.collection('landings');
  await col.deleteMany({});
  if (Array.isArray(landings) && landings.length > 0) {
    await col.insertMany(landings.map(l => ({ ...l, _id: l.id })));
  }
}

async function upsertVersionMetadata(metadata) {
  if (getEngine() !== 'mongo') {
    return;
  }

  await connectMongo();
  const col = mongoDb.collection('versions');
  await col.updateOne(
    { _id: `${metadata.landingId}:${metadata.id}` },
    { $set: { ...metadata, _id: `${metadata.landingId}:${metadata.id}` } },
    { upsert: true }
  );
}

async function getVersionsByLandingId(landingId) {
  if (getEngine() !== 'mongo') {
    return [];
  }
  await connectMongo();
  const col = mongoDb.collection('versions');
  return col
    .find({ landingId }, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
}

function parseMongoDbName(mongoUri) {
  try {
    const url = new URL(mongoUri);
    const pathname = url.pathname || '';
    const dbName = pathname.replace(/^\//, '').trim();
    return dbName || null;
  } catch (e) {
    return null;
  }
}

async function connectMongo() {
  if (mongoDb) return mongoDb;

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is required when PERSISTENCE_ENGINE=mongo');
  }

  const dbNameFromUri = parseMongoDbName(mongoUri);
  const dbName = dbNameFromUri || process.env.MONGO_DB;
  if (!dbName) {
    throw new Error('MONGO_DB is required when MONGO_URI does not include a database name');
  }

  mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  mongoDb = mongoClient.db(dbName);
  console.log(`🔌 Connected to MongoDB "${dbName}"`);
  return mongoDb;
}

async function getMongoDb() {
  return connectMongo();
}

async function getCollection(name) {
  const db = await connectMongo();
  return db.collection(name);
}

function getVersionsDir() {
  return path.join(DATA_DIR, 'versions');
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

async function syncLandingsToMongo(landings, { forceSync } = {}) {
  const col = await getCollection('landings');
  const existingCount = await col.countDocuments();
  if (existingCount > 0 && !forceSync) {
    return { skipped: true, reason: 'landings already present' };
  }

  await col.deleteMany({});
  if (!Array.isArray(landings) || landings.length === 0) {
    return { synced: 0 };
  }

  await col.insertMany(landings.map(l => ({ ...l, _id: l.id })));
  return { synced: landings.length };
}

async function syncVersionMetadataToMongo({ forceSync } = {}) {
  const col = await getCollection('versions');
  const existingCount = await col.countDocuments();
  if (existingCount > 0 && !forceSync) {
    return { skipped: true, reason: 'versions already present' };
  }

  await col.deleteMany({});

  const versionsRoot = getVersionsDir();
  if (!fs.existsSync(versionsRoot)) {
    return { synced: 0 };
  }

  const docs = [];
  const landingIds = fs.readdirSync(versionsRoot).filter(d => {
    const p = path.join(versionsRoot, d);
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  });

  for (const landingId of landingIds) {
    const landingDir = path.join(versionsRoot, landingId);
    const versionIds = fs.readdirSync(landingDir).filter(d => {
      const p = path.join(landingDir, d);
      return fs.existsSync(p) && fs.statSync(p).isDirectory();
    });

    for (const versionId of versionIds) {
      const metadataPath = path.join(landingDir, versionId, 'metadata.json');
      if (!fs.existsSync(metadataPath)) continue;
      const metadata = safeReadJson(metadataPath);
      if (!metadata) continue;

      docs.push({
        ...metadata,
        _id: `${landingId}:${metadata.id || versionId}`
      });
    }
  }

  if (docs.length === 0) {
    return { synced: 0 };
  }

  await col.insertMany(docs);
  return { synced: docs.length };
}

async function initPersistence() {
  const engine = getEngine();
  console.log(`🔧 Persistence engine: ${engine}`);

  if (engine !== 'mongo') return;

  await connectMongo();

  const shouldSync = (process.env.MONGO_SYNC_ON_BOOT || 'true').toLowerCase() === 'true';
  if (!shouldSync) {
    console.log('⏭️  Mongo bootstrap sync skipped (MONGO_SYNC_ON_BOOT=false)');
    return;
  }

  const forceSync = (process.env.MONGO_SYNC_FORCE || 'false').toLowerCase() === 'true';
  const stateCollection = mongoDb.collection('app_state');
  const existing = await stateCollection.findOne({ _id: 'db' }, { projection: { _id: 1 } });

  if (existing && !forceSync) {
    console.log('⏭️  Mongo bootstrap sync skipped (app_state already present, MONGO_SYNC_FORCE=false)');
  } else {
    const jsonDb = readJsonDB();
    const { landings: _landings, ...rest } = jsonDb || {};
    await stateCollection.updateOne(
      { _id: 'db' },
      { $set: { data: rest, syncedAt: new Date().toISOString() } },
      { upsert: true }
    );
    console.log(`✅ Mongo bootstrap sync completed (app_state)${forceSync ? ' (forced)' : ''}`);
  }

  const jsonDbForCollections = readJsonDB();
  const landingsSync = await syncLandingsToMongo(jsonDbForCollections.landings || [], { forceSync });
  if (landingsSync.skipped) {
    console.log(`⏭️  Mongo landings sync skipped (${landingsSync.reason}, MONGO_SYNC_FORCE=false)`);
  } else {
    console.log(`✅ Mongo landings sync completed (${landingsSync.synced} landings)${forceSync ? ' (forced)' : ''}`);
  }

  const versionsSync = await syncVersionMetadataToMongo({ forceSync });
  if (versionsSync.skipped) {
    console.log(`⏭️  Mongo versions metadata sync skipped (${versionsSync.reason}, MONGO_SYNC_FORCE=false)`);
  } else {
    console.log(`✅ Mongo versions metadata sync completed (${versionsSync.synced} versions)${forceSync ? ' (forced)' : ''}`);
  }
}

async function readDB() {
  const engine = getEngine();
  if (engine !== 'mongo') return readJsonDB();

  await connectMongo();
  const doc = await mongoDb.collection('app_state').findOne({ _id: 'db' });
  const state = (doc && doc.data) ? doc.data : {};

  const landings = await mongoDb
    .collection('landings')
    .find({}, { projection: { _id: 0 } })
    .toArray();

  return {
    ...state,
    landings: landings || []
  };
}

async function writeDB(data) {
  const engine = getEngine();
  if (engine !== 'mongo') {
    writeJsonDB(data);
    return;
  }

  await connectMongo();

  const { landings = [], ...rest } = data || {};

  await mongoDb.collection('app_state').updateOne(
    { _id: 'db' },
    { $set: { data: rest, updatedAt: new Date().toISOString() } },
    { upsert: true }
  );

  const col = mongoDb.collection('landings');
  const existing = await col.find({}, { projection: { _id: 1 } }).toArray();
  const existingIds = new Set(existing.map(d => d._id));
  const nextIds = new Set((landings || []).map(l => l.id));

  const ops = [];
  for (const landing of (landings || [])) {
    ops.push({
      replaceOne: {
        filter: { _id: landing.id },
        replacement: { ...landing, _id: landing.id },
        upsert: true
      }
    });
  }

  for (const id of existingIds) {
    if (!nextIds.has(id)) {
      ops.push({ deleteOne: { filter: { _id: id } } });
    }
  }

  if (ops.length > 0) {
    await col.bulkWrite(ops, { ordered: false });
  }
}

async function closeMongo() {
  if (mongoClient) {
    await mongoClient.close();
  }
  mongoClient = null;
  mongoDb = null;
}

module.exports = {
  getEngine,
  initPersistence,
  readDB,
  writeDB,
  getLandings,
  replaceLandings,
  upsertVersionMetadata,
  getVersionsByLandingId,
  getMongoDb,
  getCollection,
  closeMongo
};
