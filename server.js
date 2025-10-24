require('dotenv').config();
const express = require('express');
const basicAuth = require('express-basic-auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { spawn } = require('child_process');
const util = require('util');

// Safe command execution to prevent injection
function execCommand(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
const LANDINGS_DIR = path.join(DATA_DIR, 'landings');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(LANDINGS_DIR)) fs.mkdirSync(LANDINGS_DIR);
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ landings: [] }, null, 2));
}

// Database helpers
function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', LANDINGS_DIR);

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(DATA_DIR, 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const uploadDir = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ storage });

// Basic auth for admin
const adminAuth = basicAuth({
  users: { [process.env.ADMIN_USERNAME]: process.env.ADMIN_PASSWORD },
  challenge: true
});

// Admin panel routes
app.get('/admin', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/api/landings', adminAuth, (req, res) => {
  const db = readDB();
  res.json(db.landings);
});

app.post('/api/landings', adminAuth, upload.array('files'), async (req, res) => {
  try {
    const { slug, type, name, domains } = req.body;
    let parsedDomains = [];
    if (domains) {
      try {
        parsedDomains = typeof domains === 'string' ? JSON.parse(domains) : domains;
      } catch (e) {
        parsedDomains = [];
      }
    }
    const db = readDB();

    // Check if slug already exists
    if (db.landings.find(l => l.slug === slug)) {
      return res.status(400).json({ error: 'Slug already exists' });
    }

    const landingDir = path.join(LANDINGS_DIR, slug);
    if (!fs.existsSync(landingDir)) fs.mkdirSync(landingDir, { recursive: true });

  const landing = {
    id: Date.now().toString(),
    slug,
    name,
    type, // 'html', 'static', 'ejs'
    domains: Array.isArray(parsedDomains) ? parsedDomains : [],
    published: false,
    traefikConfigFile: '',
    createdAt: new Date().toISOString()
  };

    if (type === 'html') {
      // Single HTML file
      const content = req.body.content || '<html><body><h1>New Landing</h1></body></html>';
      fs.writeFileSync(path.join(landingDir, 'index.html'), content);
    } else if (type === 'static' && req.files.length > 0) {
      // Check if it's a zip file
      const zipFile = req.files.find(f => f.originalname.endsWith('.zip'));
      if (zipFile) {
        const zip = new AdmZip(zipFile.path);
        zip.extractAllTo(landingDir, true);
        fs.unlinkSync(zipFile.path);
      } else {
        // Multiple files
        req.files.forEach(file => {
          const dest = path.join(landingDir, file.originalname);
          fs.renameSync(file.path, dest);
        });
      }
    } else if (type === 'ejs' && req.files.length > 0) {
      // EJS template files
      req.files.forEach(file => {
        const dest = path.join(landingDir, file.originalname);
        fs.renameSync(file.path, dest);
      });
    }

    db.landings.push(landing);
    writeDB(db);

    res.json(landing);
  } catch (error) {
    console.error('Error creating landing:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/landings/:id', adminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const db = readDB();
    
    const landing = db.landings.find(l => l.id === id);
    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    if (landing.type === 'html') {
      const landingDir = path.join(LANDINGS_DIR, landing.slug);
      fs.writeFileSync(path.join(landingDir, 'index.html'), content);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Only HTML landings can be edited this way' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/landings/:id/content', adminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    
    const landing = db.landings.find(l => l.id === id);
    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    if (landing.type === 'html') {
      const landingDir = path.join(LANDINGS_DIR, landing.slug);
      const content = fs.readFileSync(path.join(landingDir, 'index.html'), 'utf-8');
      res.json({ content });
    } else {
      res.status(400).json({ error: 'Only HTML landings can be retrieved this way' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Validate Traefik environment variables
function validateTraefikEnv() {
  const required = ['TRAEFIK_REMOTE_HOST', 'TRAEFIK_REMOTE_USER', 'TRAEFIK_REMOTE_PORT', 'TRAEFIK_REMOTE_PATH', 'SERVER_IP'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required Traefik environment variables: ${missing.join(', ')}. Please configure them in .env file.`);
  }
}

// Traefik configuration management
function generateTraefikConfig(landing) {
  const serviceName = `superlandings-${landing.slug}`;
  const domains = landing.domains || [];
  
  if (domains.length === 0) {
    throw new Error('At least one domain is required');
  }
  
  // Generate Host rule for multiple domains
  const hostRules = domains.map(d => `Host(\`${d}\`)`).join(' || ');
  
  const config = `http:
  routers:
    ${serviceName}:
      entryPoints:
        - https
      service: ${serviceName}
      rule: (${hostRules}) && PathPrefix(\`/${landing.slug}\`)
      middlewares:
        - ${serviceName}-strip
      tls:
        certresolver: letsencrypt
  middlewares:
    ${serviceName}-strip:
      stripPrefix:
        prefixes:
          - /${landing.slug}
  services:
    ${serviceName}:
      loadBalancer:
        servers:
          - url: '${process.env.SERVER_IP}'
`;
  return config;
}

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
  
  // Create traefik directory if it doesn't exist
  const traefikDir = path.join(DATA_DIR, 'traefik');
  if (!fs.existsSync(traefikDir)) {
    fs.mkdirSync(traefikDir, { recursive: true });
  }

  // Generate and save config locally
  const config = generateTraefikConfig(landing);
  fs.writeFileSync(localConfigPath, config);
  console.log(`✅ Generated Traefik config: ${localConfigPath}`);

  // Deploy to remote Traefik server
  const remoteHost = process.env.TRAEFIK_REMOTE_HOST;
  const remoteUser = process.env.TRAEFIK_REMOTE_USER;
  const remotePort = process.env.TRAEFIK_REMOTE_PORT;
  const remotePath = process.env.TRAEFIK_REMOTE_PATH;
  const remoteFile = `${remotePath}/${configFileName}`;

  console.log(`📦 Deploying to ${remoteUser}@${remoteHost}:${remoteFile}`);

  try {
    // Ensure remote directory exists
    await execCommand('ssh', ['-p', remotePort, `${remoteUser}@${remoteHost}`, `mkdir -p ${remotePath}`]);
    console.log(`✅ Remote directory verified`);

    // Copy file to remote
    await execCommand('scp', ['-P', remotePort, localConfigPath, `${remoteUser}@${remoteHost}:${remoteFile}`]);
    console.log(`✅ Config deployed to remote Traefik server`);

    // Verify deployment
    const { stdout } = await execCommand('ssh', ['-p', remotePort, `${remoteUser}@${remoteHost}`, `ls -la ${remoteFile}`]);
    console.log(`✅ Verification: ${stdout.trim()}`);

    return configFileName;
  } catch (error) {
    console.error(`❌ SSH/SCP Error: ${error.message}`);
    throw new Error(`Failed to deploy config via SSH. Ensure SSH key authentication is configured and you have access to ${remoteHost}`);
  }
}

async function removeTraefikConfig(landing) {
  if (process.env.TRAEFIK_ENABLED !== 'true') {
    throw new Error('Traefik integration is not enabled. Set TRAEFIK_ENABLED=true in .env');
  }

  validateTraefikEnv();

  const configFileName = landing.traefikConfigFile || `superlandings-${landing.slug}.yml`;
  const localConfigPath = path.join(DATA_DIR, 'traefik', configFileName);

  // Remove local config
  if (fs.existsSync(localConfigPath)) {
    fs.unlinkSync(localConfigPath);
    console.log(`✅ Removed local Traefik config: ${localConfigPath}`);
  }

  // Remove from remote Traefik server
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

app.post('/api/landings/:id/publish', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    
    const landing = db.landings.find(l => l.id === id);
    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    if (!landing.domains || landing.domains.length === 0) {
      return res.status(400).json({ error: 'At least one domain is required before publishing' });
    }

    console.log(`🚀 Publishing landing: ${landing.name} (${landing.slug}) to domains: ${landing.domains.join(', ')}`);

    const configFileName = await deployTraefikConfig(landing);
    
    landing.published = true;
    landing.traefikConfigFile = configFileName;
    writeDB(db);

    const domainUrls = landing.domains.map(d => `https://${d}`).join(', ');
    console.log(`✅ Landing published successfully: ${domainUrls}`);

    res.json({ 
      success: true, 
      message: `Landing published to: ${domainUrls}`,
      landing 
    });
  } catch (error) {
    console.error('❌ Error publishing landing:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/landings/:id/unpublish', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    
    const landing = db.landings.find(l => l.id === id);
    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    if (!landing.published) {
      return res.status(400).json({ error: 'Landing is not published' });
    }

    console.log(`📤 Unpublishing landing: ${landing.name} (${landing.slug})`);

    await removeTraefikConfig(landing);
    
    landing.published = false;
    landing.traefikConfigFile = '';
    writeDB(db);

    console.log(`✅ Landing unpublished successfully`);

    res.json({ 
      success: true, 
      message: 'Landing unpublished successfully',
      landing 
    });
  } catch (error) {
    console.error('❌ Error unpublishing landing:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/landings/:id/domains', adminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { domains } = req.body;
    const db = readDB();
    
    const landing = db.landings.find(l => l.id === id);
    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    if (landing.published) {
      return res.status(400).json({ error: 'Cannot change domains of published landing. Unpublish first.' });
    }

    if (!Array.isArray(domains)) {
      return res.status(400).json({ error: 'Domains must be an array' });
    }

    console.log(`🌐 Updating domains for ${landing.name}: [${landing.domains?.join(', ')}] -> [${domains.join(', ')}]`);

    landing.domains = domains;
    writeDB(db);

    console.log(`✅ Domains updated successfully`);

    res.json({ success: true, landing });
  } catch (error) {
    console.error('❌ Error updating domains:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/landings/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    
    const landingIndex = db.landings.findIndex(l => l.id === id);
    if (landingIndex === -1) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    const landing = db.landings[landingIndex];
    const landingDir = path.join(LANDINGS_DIR, landing.slug);
    
    console.log(`🗑️  Deleting landing: ${landing.name} (${landing.slug})`);

    // Unpublish if published
    if (landing.published) {
      try {
        await removeTraefikConfig(landing);
        console.log(`✅ Traefik config removed`);
      } catch (error) {
        console.error(`⚠️  Warning: Could not remove Traefik config:`, error.message);
      }
    }
    
    // Remove directory
    if (fs.existsSync(landingDir)) {
      fs.rmSync(landingDir, { recursive: true, force: true });
      console.log(`✅ Landing directory removed`);
    }

    db.landings.splice(landingIndex, 1);
    writeDB(db);
    
    console.log(`✅ Landing deleted successfully`);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Home route
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>SuperLandings</title></head>
      <body style="font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px;">
        <h1>SuperLandings</h1>
        <p>Welcome to SuperLandings - Multi-landing page server</p>
        <p><a href="/admin">Go to Admin Panel</a></p>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`SuperLandings server running on http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`Username: ${process.env.ADMIN_USERNAME}`);
  console.log(`Password: ${process.env.ADMIN_PASSWORD}`);
});

// Serve static assets for static landings (must be before /:slug route)
app.use('/:slug/*', (req, res, next) => {
  const { slug } = req.params;
  const db = readDB();
  const landing = db.landings.find(l => l.slug === slug);
  
  if (landing && landing.type === 'static') {
    express.static(path.join(LANDINGS_DIR, slug))(req, res, next);
  } else {
    next();
  }
});

// Landing page routes (MUST BE LAST to avoid catching /admin and /api routes)
app.get('/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const db = readDB();
    
    const landing = db.landings.find(l => l.slug === slug);
    if (!landing) {
      return res.status(404).send('Landing not found');
    }

    const landingDir = path.join(LANDINGS_DIR, slug);

    if (landing.type === 'html') {
      res.sendFile(path.join(landingDir, 'index.html'));
    } else if (landing.type === 'static') {
      res.sendFile(path.join(landingDir, 'index.html'));
    } else if (landing.type === 'ejs') {
      res.render(path.join(slug, 'index'));
    }
  } catch (error) {
    console.error('Error serving landing:', error);
    res.status(500).send('Error loading landing page');
  }
});
