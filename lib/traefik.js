const fs = require('fs');
const path = require('path');
const os = require('os');
const { execCommand } = require('./utils');
const { DATA_DIR, getPublishedDomains } = require('./db');
const { getTraefikSetting } = require('./traefik-settings');

// Helper to extract first and last chars of the key for debugging
function getKeyHint(sshKey) {
  if (!sshKey) return 'None';
  const cleanKey = sshKey
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
  if (cleanKey.length <= 8) return cleanKey;
  return `${cleanKey.substring(0, 4)}...${cleanKey.substring(cleanKey.length - 4)}`;
}

// Helper to execute code with a temporary SSH key
async function withTempSshKey(sshKey, callback) {
  // If no key is provided, we still run the callback with null keyPath.
  // The caller must decide if this is allowed.
  if (!sshKey) return await callback(null);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-ssh-'));
  const keyPath = path.join(tempDir, 'id_rsa');
  
  try {
    // Ensure key ends with a newline (some SSH clients require it)
    const formattedKey = sshKey.trim() + '\n';
    
    // Basic validation: check if it looks like a private key
    if (!formattedKey.includes('PRIVATE KEY')) {
      throw new Error('Invalid SSH private key format. Must be a valid PEM/OpenSSH private key.');
    }

    fs.writeFileSync(keyPath, formattedKey, { mode: 0o600 });
    return await callback(keyPath);
  } catch (err) {
    console.error('SSH Key Setup Error:', err.message);
    throw err; // Re-throw to be caught by the caller
  } finally {
    try {
      if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.error('Error cleaning up temp SSH key:', err);
    }
  }
}

// Internal helper to get SSH key with fallback to DB setting
async function getEffectiveSshKey(providedKey) {
  if (providedKey) return providedKey;
  return await getTraefikSetting('TRAEFIK_SSH_KEY');
}

// Validate Traefik environment variables
async function validateTraefikEnv() {
  const required = ['TRAEFIK_REMOTE_HOST', 'TRAEFIK_REMOTE_USER', 'TRAEFIK_REMOTE_PORT', 'TRAEFIK_REMOTE_PATH', 'SERVER_IP'];
  const missing = [];
  
  for (const key of required) {
    const value = await getTraefikSetting(key);
    if (!value) missing.push(key);
  }

  if (missing.length > 0) {
    throw new Error(`Missing required Traefik configuration: ${missing.join(', ')}. Please configure them in System Settings.`);
  }
}

// Generate Traefik YAML config for a landing
async function generateTraefikConfig(landing) {
  if (landing.type === 'traefik-config') {
    return landing.content || '';
  }

  const serviceName = `superlandings-${landing.slug}`;
  const publishedDomains = getPublishedDomains(landing.domains || []);
  
  if (publishedDomains.length === 0) {
    throw new Error('At least one published domain is required');
  }
  
  const hostRules = publishedDomains.map(d => `Host(\`${d}\`)`).join(' || ');
  const serverIp = await getTraefikSetting('SERVER_IP');
  
  const config = `http:
  routers:
    ${serviceName}:
      entryPoints:
        - https
      service: ${serviceName}
      rule: ${hostRules}
      middlewares:
        - ${serviceName}-addprefix
      tls:
        certresolver: letsencrypt
  middlewares:
    ${serviceName}-addprefix:
      addPrefix:
        prefix: /${landing.slug}
  services:
    ${serviceName}:
      loadBalancer:
        servers:
          - url: '${serverIp}'
`;
  return config;
}

// Generate Traefik YAML config for admin
async function generateAdminTraefikConfig(domains) {
  const serviceName = 'superlandings-admin';
  const hostRules = domains.map(d => `Host(\`${d}\`)`).join(' || ');
  const serverIp = await getTraefikSetting('SERVER_IP');
  
  const config = `http:
  routers:
    ${serviceName}:
      entryPoints:
        - https
      service: ${serviceName}
      rule: ${hostRules}
      tls:
        certresolver: letsencrypt
  services:
    ${serviceName}:
      loadBalancer:
        servers:
          - url: '${serverIp}'
`;
  return config;
}

// Deploy Traefik config to remote server
async function deployTraefikConfig(landing, sshKey = null) {
  const traefikEnabled = await getTraefikSetting('TRAEFIK_ENABLED');
  if (traefikEnabled !== true && traefikEnabled !== 'true') {
    throw new Error('Traefik integration is not enabled. Please enable it in System Settings.');
  }

  await validateTraefikEnv();

  if (!landing.domains || landing.domains.length === 0) {
    throw new Error('At least one domain is required for publishing');
  }

  const configFileName = `superlandings-${landing.slug}.yml`;
  const localConfigPath = path.join(DATA_DIR, 'traefik', configFileName);
  
  const traefikDir = path.join(DATA_DIR, 'traefik');
  if (!fs.existsSync(traefikDir)) {
    fs.mkdirSync(traefikDir, { recursive: true });
  }

  const config = await generateTraefikConfig(landing);
  fs.writeFileSync(localConfigPath, config);
  console.log(`✅ Generated Traefik config: ${localConfigPath}`);

  const remoteHost = await getTraefikSetting('TRAEFIK_REMOTE_HOST');
  const remoteUser = await getTraefikSetting('TRAEFIK_REMOTE_USER');
  const remotePort = await getTraefikSetting('TRAEFIK_REMOTE_PORT');
  const remotePath = await getTraefikSetting('TRAEFIK_REMOTE_PATH');
  const remoteFile = `${remotePath}/${configFileName}`;
  const effectiveSshKey = await getEffectiveSshKey(sshKey);

  console.log(`📦 Deploying to ${remoteUser}@${remoteHost}:${remoteFile}`);

  return withTempSshKey(effectiveSshKey, async (keyPath) => {
    const commonSshArgs = ['-p', remotePort, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10'];
    const commonScpArgs = ['-P', remotePort, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10'];
    
    if (keyPath) {
      commonSshArgs.push('-i', keyPath, '-o', 'IdentitiesOnly=yes');
      commonScpArgs.push('-i', keyPath, '-o', 'IdentitiesOnly=yes');
    }

    try {
      await execCommand('ssh', [...commonSshArgs, `${remoteUser}@${remoteHost}`, `mkdir -p ${remotePath}`]);
      console.log(`✅ Remote directory verified`);

      await execCommand('scp', [...commonScpArgs, localConfigPath, `${remoteUser}@${remoteHost}:${remoteFile}`]);
      console.log(`✅ Config deployed to remote Traefik server`);

      const { stdout } = await execCommand('ssh', [...commonSshArgs, `${remoteUser}@${remoteHost}`, `ls -la ${remoteFile}`]);
      console.log(`✅ Verification: ${stdout.trim()}`);

      return configFileName;
    } catch (error) {
      const keyHint = getKeyHint(effectiveSshKey);
      console.error(`❌ SSH/SCP Error: ${error.message}`);
      throw new Error(`SSH deployment failed: ${error.message} (Key hint: ${keyHint}). Check host availability and authentication.`);
    }
  });
}

// Remove Traefik config from remote server
async function removeTraefikConfig(landing, sshKey = null) {
  const traefikEnabled = await getTraefikSetting('TRAEFIK_ENABLED');
  if (traefikEnabled !== true && traefikEnabled !== 'true') {
    throw new Error('Traefik integration is not enabled.');
  }

  await validateTraefikEnv();

  const configFileName = landing.traefikConfigFile || `superlandings-${landing.slug}.yml`;
  const localConfigPath = path.join(DATA_DIR, 'traefik', configFileName);

  if (fs.existsSync(localConfigPath)) {
    fs.unlinkSync(localConfigPath);
    console.log(`✅ Removed local Traefik config: ${localConfigPath}`);
  }

  const remoteHost = await getTraefikSetting('TRAEFIK_REMOTE_HOST');
  const remoteUser = await getTraefikSetting('TRAEFIK_REMOTE_USER');
  const remotePort = await getTraefikSetting('TRAEFIK_REMOTE_PORT');
  const remotePath = await getTraefikSetting('TRAEFIK_REMOTE_PATH');
  const remoteFile = `${remotePath}/${configFileName}`;
  const effectiveSshKey = await getEffectiveSshKey(sshKey);

  console.log(`🗑️  Removing from ${remoteUser}@${remoteHost}:${remoteFile}`);

  return withTempSshKey(effectiveSshKey, async (keyPath) => {
    const commonSshArgs = ['-p', remotePort, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10'];
    if (keyPath) {
      commonSshArgs.push('-i', keyPath, '-o', 'IdentitiesOnly=yes');
    }

    try {
      await execCommand('ssh', [...commonSshArgs, `${remoteUser}@${remoteHost}`, `rm -f ${remoteFile}`]);
      console.log(`✅ Config removed from remote Traefik server`);
    } catch (error) {
      const keyHint = getKeyHint(effectiveSshKey);
      console.error(`❌ SSH Error: ${error.message}`);
      throw new Error(`SSH removal failed: ${error.message} (Key hint: ${keyHint})`);
    }
  });
}

// Deploy admin Traefik config
async function deployAdminTraefikConfig(domains, sshKey = null) {
  const traefikEnabled = await getTraefikSetting('TRAEFIK_ENABLED');
  if (traefikEnabled !== true && traefikEnabled !== 'true') {
    return 'superlandings-admin.yml';
  }

  await validateTraefikEnv();

  const configFileName = 'superlandings-admin.yml';
  const localConfigPath = path.join(DATA_DIR, 'traefik', configFileName);
  
  const traefikDir = path.join(DATA_DIR, 'traefik');
  if (!fs.existsSync(traefikDir)) {
    fs.mkdirSync(traefikDir, { recursive: true });
  }

  const config = await generateAdminTraefikConfig(domains);
  fs.writeFileSync(localConfigPath, config);
  console.log(`✅ Generated Traefik config: ${localConfigPath}`);

  const remoteHost = await getTraefikSetting('TRAEFIK_REMOTE_HOST');
  const remoteUser = await getTraefikSetting('TRAEFIK_REMOTE_USER');
  const remotePort = await getTraefikSetting('TRAEFIK_REMOTE_PORT');
  const remotePath = await getTraefikSetting('TRAEFIK_REMOTE_PATH');
  const remoteFile = `${remotePath}/${configFileName}`;
  const effectiveSshKey = await getEffectiveSshKey(sshKey);

  console.log(`📦 Deploying to ${remoteUser}@${remoteHost}:${remoteFile}`);

  return withTempSshKey(effectiveSshKey, async (keyPath) => {
    const commonSshArgs = ['-p', remotePort, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10'];
    const commonScpArgs = ['-P', remotePort, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10'];
    
    if (keyPath) {
      commonSshArgs.push('-i', keyPath, '-o', 'IdentitiesOnly=yes');
      commonScpArgs.push('-i', keyPath, '-o', 'IdentitiesOnly=yes');
    }

    try {
      await execCommand('ssh', [...commonSshArgs, `${remoteUser}@${remoteHost}`, `mkdir -p ${remotePath}`]);
      await execCommand('scp', [...commonScpArgs, localConfigPath, `${remoteUser}@${remoteHost}:${remoteFile}`]);
      const { stdout } = await execCommand('ssh', [...commonSshArgs, `${remoteUser}@${remoteHost}`, `ls -la ${remoteFile}`]);
      console.log(`✅ Verification: ${stdout.trim()}`);
      return configFileName;
    } catch (error) {
      const keyHint = getKeyHint(effectiveSshKey);
      console.error(`❌ SSH/SCP Error: ${error.message}`);
      throw new Error(`SSH admin deployment failed: ${error.message} (Key hint: ${keyHint})`);
    }
  });
}

// Remove admin Traefik config
async function removeAdminTraefikConfig(configFileName, sshKey = null) {
  const traefikEnabled = await getTraefikSetting('TRAEFIK_ENABLED');
  if (traefikEnabled !== true && traefikEnabled !== 'true') {
    return;
  }

  await validateTraefikEnv();

  const localConfigPath = path.join(DATA_DIR, 'traefik', configFileName);

  if (fs.existsSync(localConfigPath)) {
    fs.unlinkSync(localConfigPath);
    console.log(`✅ Removed local Traefik config: ${localConfigPath}`);
  }

  const remoteHost = await getTraefikSetting('TRAEFIK_REMOTE_HOST');
  const remoteUser = await getTraefikSetting('TRAEFIK_REMOTE_USER');
  const remotePort = await getTraefikSetting('TRAEFIK_REMOTE_PORT');
  const remotePath = await getTraefikSetting('TRAEFIK_REMOTE_PATH');
  const remoteFile = `${remotePath}/${configFileName}`;
  const effectiveSshKey = await getEffectiveSshKey(sshKey);

  console.log(`🗑️  Removing from ${remoteUser}@${remoteHost}:${remoteFile}`);

  return withTempSshKey(effectiveSshKey, async (keyPath) => {
    const commonSshArgs = ['-p', remotePort, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10'];
    if (keyPath) {
      commonSshArgs.push('-i', keyPath, '-o', 'IdentitiesOnly=yes');
    }

    try {
      await execCommand('ssh', [...commonSshArgs, `${remoteUser}@${remoteHost}`, `rm -f ${remoteFile}`]);
      console.log(`✅ Config removed from remote Traefik server`);
    } catch (error) {
      const keyHint = getKeyHint(effectiveSshKey);
      console.error(`❌ SSH Error: ${error.message}`);
      throw new Error(`SSH admin removal failed: ${error.message} (Key hint: ${keyHint})`);
    }
  });
}

module.exports = {
  validateTraefikEnv,
  generateTraefikConfig,
  generateAdminTraefikConfig,
  deployTraefikConfig,
  removeTraefikConfig,
  deployAdminTraefikConfig,
  removeAdminTraefikConfig
};
