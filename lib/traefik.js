const fs = require('fs');
const path = require('path');
const { execCommand } = require('./utils');
const { DATA_DIR, getPublishedDomains } = require('./db');

// Validate Traefik environment variables
function validateTraefikEnv() {
  const required = ['TRAEFIK_REMOTE_HOST', 'TRAEFIK_REMOTE_USER', 'TRAEFIK_REMOTE_PORT', 'TRAEFIK_REMOTE_PATH', 'SERVER_IP'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required Traefik environment variables: ${missing.join(', ')}. Please configure them in .env file.`);
  }
}

// Generate Traefik YAML config for a landing
function generateTraefikConfig(landing) {
  const serviceName = `superlandings-${landing.slug}`;
  const publishedDomains = getPublishedDomains(landing.domains || []);
  
  if (publishedDomains.length === 0) {
    throw new Error('At least one published domain is required');
  }
  
  const hostRules = publishedDomains.map(d => `Host(\`${d}\`)`).join(' || ');
  
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
          - url: '${process.env.SERVER_IP}'
`;
  return config;
}

// Generate Traefik YAML config for admin
function generateAdminTraefikConfig(domains) {
  const serviceName = 'superlandings-admin';
  const hostRules = domains.map(d => `Host(\`${d}\`)`).join(' || ');
  
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
          - url: '${process.env.SERVER_IP}'
`;
  return config;
}

// Deploy Traefik config to remote server
async function deployTraefikConfig(landing) {
  if (process.env.TRAEFIK_ENABLED !== 'true') {
    throw new Error('Traefik integration is not enabled. Set TRAEFIK_ENABLED=true in .env');
  }

  validateTraefikEnv();

  if (!landing.domains || landing.domains.length === 0) {
    throw new Error('At least one domain is required for publishing');
  }

  const configFileName = `superlandings-${landing.slug}.yml`;
  const localConfigPath = path.join(DATA_DIR, 'traefik', configFileName);
  
  const traefikDir = path.join(DATA_DIR, 'traefik');
  if (!fs.existsSync(traefikDir)) {
    fs.mkdirSync(traefikDir, { recursive: true });
  }

  const config = generateTraefikConfig(landing);
  fs.writeFileSync(localConfigPath, config);
  console.log(`✅ Generated Traefik config: ${localConfigPath}`);

  const remoteHost = process.env.TRAEFIK_REMOTE_HOST;
  const remoteUser = process.env.TRAEFIK_REMOTE_USER;
  const remotePort = process.env.TRAEFIK_REMOTE_PORT;
  const remotePath = process.env.TRAEFIK_REMOTE_PATH;
  const remoteFile = `${remotePath}/${configFileName}`;

  console.log(`📦 Deploying to ${remoteUser}@${remoteHost}:${remoteFile}`);

  try {
    await execCommand('ssh', ['-p', remotePort, `${remoteUser}@${remoteHost}`, `mkdir -p ${remotePath}`]);
    console.log(`✅ Remote directory verified`);

    await execCommand('scp', ['-P', remotePort, localConfigPath, `${remoteUser}@${remoteHost}:${remoteFile}`]);
    console.log(`✅ Config deployed to remote Traefik server`);

    const { stdout } = await execCommand('ssh', ['-p', remotePort, `${remoteUser}@${remoteHost}`, `ls -la ${remoteFile}`]);
    console.log(`✅ Verification: ${stdout.trim()}`);

    return configFileName;
  } catch (error) {
    console.error(`❌ SSH/SCP Error: ${error.message}`);
    throw new Error(`Failed to deploy config via SSH. Ensure SSH key authentication is configured and you have access to ${remoteHost}`);
  }
}

// Remove Traefik config from remote server
async function removeTraefikConfig(landing) {
  if (process.env.TRAEFIK_ENABLED !== 'true') {
    throw new Error('Traefik integration is not enabled. Set TRAEFIK_ENABLED=true in .env');
  }

  validateTraefikEnv();

  const configFileName = landing.traefikConfigFile || `superlandings-${landing.slug}.yml`;
  const localConfigPath = path.join(DATA_DIR, 'traefik', configFileName);

  if (fs.existsSync(localConfigPath)) {
    fs.unlinkSync(localConfigPath);
    console.log(`✅ Removed local Traefik config: ${localConfigPath}`);
  }

  const remoteHost = process.env.TRAEFIK_REMOTE_HOST;
  const remoteUser = process.env.TRAEFIK_REMOTE_USER;
  const remotePort = process.env.TRAEFIK_REMOTE_PORT;
  const remotePath = process.env.TRAEFIK_REMOTE_PATH;
  const remoteFile = `${remotePath}/${configFileName}`;

  console.log(`🗑️  Removing from ${remoteUser}@${remoteHost}:${remoteFile}`);

  try {
    await execCommand('ssh', ['-p', remotePort, `${remoteUser}@${remoteHost}`, `rm -f ${remoteFile}`]);
    console.log(`✅ Config removed from remote Traefik server`);
  } catch (error) {
    console.error(`❌ SSH Error: ${error.message}`);
    throw new Error(`Failed to remove config via SSH. Ensure you have access to ${remoteHost}`);
  }
}

// Deploy admin Traefik config
async function deployAdminTraefikConfig(domains) {
  if (process.env.TRAEFIK_ENABLED !== 'true') {
    return 'superlandings-admin.yml';
  }

  validateTraefikEnv();

  const configFileName = 'superlandings-admin.yml';
  const localConfigPath = path.join(DATA_DIR, 'traefik', configFileName);
  
  const traefikDir = path.join(DATA_DIR, 'traefik');
  if (!fs.existsSync(traefikDir)) {
    fs.mkdirSync(traefikDir, { recursive: true });
  }

  const config = generateAdminTraefikConfig(domains);
  fs.writeFileSync(localConfigPath, config);
  console.log(`✅ Generated Traefik config: ${localConfigPath}`);

  const remoteHost = process.env.TRAEFIK_REMOTE_HOST;
  const remoteUser = process.env.TRAEFIK_REMOTE_USER;
  const remotePort = process.env.TRAEFIK_REMOTE_PORT;
  const remotePath = process.env.TRAEFIK_REMOTE_PATH;
  const remoteFile = `${remotePath}/${configFileName}`;

  console.log(`📦 Deploying to ${remoteUser}@${remoteHost}:${remoteFile}`);

  try {
    await execCommand('ssh', ['-p', remotePort, `${remoteUser}@${remoteHost}`, `mkdir -p ${remotePath}`]);
    await execCommand('scp', ['-P', remotePort, localConfigPath, `${remoteUser}@${remoteHost}:${remoteFile}`]);
    const { stdout } = await execCommand('ssh', ['-p', remotePort, `${remoteUser}@${remoteHost}`, `ls -la ${remoteFile}`]);
    console.log(`✅ Verification: ${stdout.trim()}`);
  } catch (error) {
    console.error(`❌ SSH/SCP Error: ${error.message}`);
    throw new Error(`Failed to deploy config via SSH. Ensure SSH key authentication is configured and you have access to ${remoteHost}`);
  }

  return configFileName;
}

// Remove admin Traefik config
async function removeAdminTraefikConfig(configFileName) {
  if (process.env.TRAEFIK_ENABLED !== 'true') {
    return;
  }

  validateTraefikEnv();

  const localConfigPath = path.join(DATA_DIR, 'traefik', configFileName);

  if (fs.existsSync(localConfigPath)) {
    fs.unlinkSync(localConfigPath);
    console.log(`✅ Removed local Traefik config: ${localConfigPath}`);
  }

  const remoteHost = process.env.TRAEFIK_REMOTE_HOST;
  const remoteUser = process.env.TRAEFIK_REMOTE_USER;
  const remotePort = process.env.TRAEFIK_REMOTE_PORT;
  const remotePath = process.env.TRAEFIK_REMOTE_PATH;
  const remoteFile = `${remotePath}/${configFileName}`;

  console.log(`🗑️  Removing from ${remoteUser}@${remoteHost}:${remoteFile}`);

  try {
    await execCommand('ssh', ['-p', remotePort, `${remoteUser}@${remoteHost}`, `rm -f ${remoteFile}`]);
    console.log(`✅ Config removed from remote Traefik server`);
  } catch (error) {
    console.error(`❌ SSH Error: ${error.message}`);
    throw new Error(`Failed to remove config via SSH. Ensure you have access to ${remoteHost}`);
  }
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
