const { MongoClient } = require('mongodb');

const { readDB: readJsonDB, writeDB: writeJsonDB } = require('./db');

let mongoClient = null;
let mongoDb = null;

function getEngine() {
  return (process.env.PERSISTENCE_ENGINE || 'json').toLowerCase();
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
  const collection = mongoDb.collection('app_state');
  const existing = await collection.findOne({ _id: 'db' }, { projection: { _id: 1 } });

  if (existing && !forceSync) {
    console.log('⏭️  Mongo bootstrap sync skipped (data already present, MONGO_SYNC_FORCE=false)');
    return;
  }

  const jsonDb = readJsonDB();
  await collection.updateOne(
    { _id: 'db' },
    { $set: { data: jsonDb, syncedAt: new Date().toISOString() } },
    { upsert: true }
  );
  console.log(`✅ Mongo bootstrap sync completed${forceSync ? ' (forced)' : ''}`);
}

async function readDB() {
  const engine = getEngine();
  if (engine !== 'mongo') return readJsonDB();

  await connectMongo();
  const doc = await mongoDb.collection('app_state').findOne({ _id: 'db' });
  return (doc && doc.data) ? doc.data : { landings: [] };
}

async function writeDB(data) {
  const engine = getEngine();
  if (engine !== 'mongo') {
    writeJsonDB(data);
    return;
  }

  await connectMongo();
  await mongoDb.collection('app_state').updateOne(
    { _id: 'db' },
    { $set: { data, updatedAt: new Date().toISOString() } },
    { upsert: true }
  );
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
  getMongoDb,
  getCollection,
  closeMongo
};
