const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const MongoStore = require('connect-mongo');

const { ensureDirectories, DATA_DIR, LANDINGS_DIR } = require('./lib/db');
const { getEngine, readDB, readDBMeta, writeDB } = require('./lib/store');
const { sessionAuth, setCurrentOrganization, handleLogin, hashPassword } = require('./lib/auth');
const landingsRouter = require('./routes/landings');
const adminConfigRouter = require('./routes/admin-config');
const organizationsRouter = require('./routes/organizations');
const usersRouter = require('./routes/users');
const migrationRouter = require('./routes/migration');
const cloudflareRouter = require('./routes/cloudflare');
const {
  attachDb,
  domainStaticMiddleware,
  slugStaticMiddleware,
  serveLandingByDomain,
  serveLandingBySlug,
  serveEjsSubPage,
} = require('./routes/serve');

const superbackend = require('./lib/superbackend');

// Generate a secure session secret; refuse to boot in production without one.
function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: SESSION_SECRET environment variable is required in production!');
    process.exit(1);
  }
  const crypto = require('crypto');
  console.warn('⚠️  Using generated session secret in development. Set SESSION_SECRET for production.');
  return crypto.randomBytes(64).toString('hex');
}

function createApp() {
  const app = express();

  app.locals.ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  app.locals.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  app.locals.REGISTRATION_ENABLED = process.env.REGISTRATION_ENABLED === 'true';
  app.locals.MAX_WEBSITES_PER_USER = parseInt(process.env.MAX_WEBSITES_PER_USER || '5', 10);

  ensureDirectories();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mount superbackend at /saas (direct) and /:slug/saas (Traefik addPrefix)
  const sbMiddleware = superbackend.middleware({
    mongodbUri: process.env.MONGO_URI,
    skipBodyParser: true,
    adminUsername: process.env.ADMIN_USERNAME,
    adminPassword: process.env.ADMIN_PASSWORD,
  });
  app.use('/saas', sbMiddleware);
  app.use('/:slug/saas', (req, res, next) => {
    sbMiddleware(req, res, next);
  });



  const sessionTtlSeconds = parseInt(process.env.SESSION_TTL_SECONDS || `${24 * 60 * 60}`, 10);
  const sessionStore = getEngine() === 'mongo'
    ? MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        dbName: process.env.MONGO_DB,
        collectionName: 'sessions',
        ttl: sessionTtlSeconds,
      })
    : new FileStore({
        path: path.join(DATA_DIR, 'sessions'),
        ttl: 24 * 60 * 60 * 30,
        reapInterval: 60 * 60,
      });

  app.use(session({
    store: sessionStore,
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, sameSite: 'strict', maxAge: sessionTtlSeconds * 1000 },
  }));

  app.use(express.static(path.join(__dirname, 'public')));

  app.set('view engine', 'ejs');
  app.set('views', [path.join(__dirname, 'views'), LANDINGS_DIR]);

  // Multer: custom storage that preserves original relative paths
  const storage = {
    _handleFile(req, file, cb) {
      const originalPath = file.originalname || file.name || 'unnamed';
      const safeTempName = Date.now() + '-' + originalPath.replace(/[\/\\]/g, '_');
      const dest = path.join(DATA_DIR, 'uploads', safeTempName);
      file.storedOriginalName = originalPath;
      const outStream = fs.createWriteStream(dest);
      file.stream.pipe(outStream);
      outStream.on('error', cb);
      outStream.on('finish', () => cb(null, {
        destination: path.join(DATA_DIR, 'uploads'),
        filename: safeTempName,
        path: dest,
        size: outStream.bytesWritten,
      }));
    },
    _removeFile(req, file, cb) { fs.unlink(file.path, cb); },
  };
  const upload = multer({ storage });

  // Auth pages
  app.get('/login', (req, res) => res.render('admin/login'));
  app.get('/register', (req, res) => {
    if (process.env.REGISTRATION_ENABLED !== 'true') return res.redirect('/login');
    res.render('admin/register');
  });

  // Registration endpoint
  app.post('/api/register', async (req, res) => {
    if (process.env.REGISTRATION_ENABLED !== 'true') {
      return res.status(403).json({ error: 'Registration is disabled' });
    }
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 3) return res.status(400).json({ error: 'Password must be at least 3 characters' });

    try {
      const db = await readDB();
      if (!db.users) db.users = [];
      if (!db.organizations) db.organizations = [];
      if (db.users.some(u => u.email === email)) return res.status(400).json({ error: 'User already exists' });

      const user = { email: email.trim(), password: hashPassword(password), createdAt: new Date().toISOString() };
      db.users.push(user);

      const organization = {
        id: Date.now().toString(),
        name: `${email}'s Workspace`,
        users: [{ email: email.trim(), rights: ['landings:create', 'landings:update', 'landings:domains', 'landings:delete'] }],
        createdAt: new Date().toISOString(),
      };
      db.organizations.push(organization);
      await writeDB(db);

      req.session.user = { email: user.email, isAdmin: false };
      req.session.isAdmin = false;
      res.json({ success: true, user: { email: user.email, isAdmin: false }, organizationId: organization.id });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // Login / logout
  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const result = await handleLogin(req, username, password);
    if (!result.success) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true, user: result.user });
  });

  app.get('/api/logout', sessionAuth, (req, res) => {
    req.session.destroy(err => {
      if (err) return res.status(500).json({ error: 'Logout failed' });
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });

  // Admin panel
  app.get('/', (req, res) => res.redirect('/admin'));

  // Admin v2 (new UI) — served from ui/ directory, now the DEFAULT at /admin
  // No-cache in dev to pick up JS changes on refresh
  const staticOpts = process.env.NODE_ENV === 'development'
    ? { etag: false, lastModified: false, setHeaders: (res) => { res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate'); } }
    : {};
  app.use('/admin/static', express.static(path.join(__dirname, 'ui'), staticOpts));
  app.get('/admin', (req, res) => {
    if (!req.session || !req.session.user) return res.redirect('/login');
    // Check if user prefers legacy UI (localStorage flag checked client-side via query param)
    const useLegacy = req.query.legacy === '1';
    if (useLegacy) return res.render('admin/index');
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('ETag', '');
      res.setHeader('Last-Modified', '');
    }
    res.sendFile(path.join(__dirname, 'ui', 'index.html'));
  });

  // Legacy admin UI — accessible via /admin?legacy=1 or /admin-legacy
  app.get('/admin-legacy', (req, res) => {
    if (!req.session || !req.session.user) return res.redirect('/login?next=/admin-legacy');
    res.render('admin/index');
  });

  // Keep /admin-v2 as alias for backwards compat
  app.use('/admin-v2/static', express.static(path.join(__dirname, 'ui'), staticOpts));
  app.get('/admin-v2', (req, res) => {
    if (!req.session || !req.session.user) return res.redirect('/login?next=/admin-v2');
    res.sendFile(path.join(__dirname, 'ui', 'index.html'));
  });

  // API routes
  app.use('/api/landings', sessionAuth, setCurrentOrganization,
    upload.array('files'),
    landingsRouter,
  );
  app.use('/api/admin-config', sessionAuth, adminConfigRouter);
  app.use('/api/organizations', sessionAuth, organizationsRouter);
  app.use('/api/users', sessionAuth, usersRouter);
  app.use('/api/migration', sessionAuth, migrationRouter);
  app.use('/api/cloudflare', sessionAuth, setCurrentOrganization, cloudflareRouter);

  app.get('/api/auth/me', sessionAuth, setCurrentOrganization, async (req, res) => {
    let organizations = req.userOrganizations || [];
    if (req.adminAuth) {
      const db = await readDBMeta();
      organizations = db.organizations || [];
    }
    res.json({
      isAdmin: req.adminAuth,
      user: req.currentUser ? { email: req.currentUser.email, isAdmin: req.currentUser.isAdmin } : null,
      organizations,
      currentOrganization: req.currentOrganization || null,
      rights: req.currentUser?.rights || [],
    });
  });

  // Public serving (order matters)
  app.use('/*', attachDb);
  app.use('/*', domainStaticMiddleware);        // static assets for domain-based routing
  app.use('/:slug/*', slugStaticMiddleware);    // static assets for slug-based routing
  app.use('/*', serveLandingByDomain);          // domain-based root + sub-paths
  app.get('/:slug', serveLandingBySlug);        // slug-based landing serving
  app.get('/:slug/*', serveEjsSubPage);         // ejs sub-pages (e.g. /blog-intrane-fr/post-slug)

  return app;
}

module.exports = { createApp };
