const { testSshConnectivity } = require('../lib/traefik');
require('dotenv').config();
const saasbackend = process.env.NODE_ENV === 'production'
  ? require('saasbackend')
  : require('../ref-saasbackend');

async function runSmokeTest() {
  console.log('--- SSH Connectivity Smoke Test (Using DB Key) ---');
  
  try {
    // Initialize SaasBackend to establish DB connection
    console.log('Initializing SaaSBackend connection...');
    await saasbackend.middleware({
      mongodbUri: process.env.MONGO_URI,
      skipBodyParser: true
    });

    // This will use getEffectiveSshKey(null) which pulls from DB TRAEFIK_SSH_KEY
    console.log('Attempting SSH connection using persisted DB key...');
    const result = await testSshConnectivity();
    
    if (result.success) {
      console.log('✅ SSH Success!');
      console.log('Output:', result.output);
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ SSH Failure:', err.message);
    
    if (err.message.includes('Permission denied')) {
      console.log('\n--- Debugging Tips ---');
      console.log('1. The key hint above confirms which key was used.');
      console.log('2. If this fails but the previous test with local id_rsa passed, compare the hints.');
      console.log('3. "IdentitiesOnly=yes" is being used, forcing ONLY the DB key.');
    }
    process.exit(1);
  }
}

runSmokeTest();
