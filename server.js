require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const FileStore = require('session-file-store')(session);

// Local modules
const { ensureDirectories, DATA_DIR, LANDINGS_DIR } = require('./lib/db');
const { initPersistence } = require('./lib/store');
const { sessionAuth, setCurrentOrganization, handleLogin } = require('./lib/auth');
const landingsRouter = require('./routes/landings');
const adminConfigRouter = require('./routes/admin-config');
const organizationsRouter = require('./routes/organizations');
const usersRouter = require('./routes/users');
const migrationRouter = require('./routes/migration');
const { domainStaticMiddleware, slugStaticMiddleware, serveLandingByDomain, serveLandingBySlug } = require('./routes/serve');

// Initialize
const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data directories exist
ensureDirectories();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware with file store
app.use(session({
  store: new FileStore({
    path: path.join(DATA_DIR, 'sessions'),
    ttl: 24 * 60 * 60 * 30, // 1 month
    reapInterval: 60 * 60 // Cleanup every hour
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// EJS setup - views directory includes both admin views and landing views
app.set('view engine', 'ejs');
app.set('views', [path.join(__dirname, 'views'), LANDINGS_DIR]);

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(DATA_DIR, 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Login page route
app.get('/login', (req, res) => {
  res.render('admin/login');
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const result = await handleLogin(req, username, password);
  
  if (!result.success) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({
    success: true,
    user: result.user
  });
});

// Logout endpoint
app.get('/api/logout', sessionAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Root redirect to admin
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Admin panel route (EJS) with auth check
app.get('/admin', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  res.render('admin/index');
});

// API routes with auth and organization context
app.use('/api/landings', sessionAuth, setCurrentOrganization, upload.array('files'), landingsRouter);
app.use('/api/admin-config', sessionAuth, adminConfigRouter);
app.use('/api/organizations', sessionAuth, organizationsRouter);
app.use('/api/users', sessionAuth, usersRouter);
app.use('/api/migration', sessionAuth, migrationRouter);

// Auth info endpoint
app.get('/api/auth/me', sessionAuth, setCurrentOrganization, (req, res) => {
  res.json({
    isAdmin: req.adminAuth,
    user: req.currentUser ? { email: req.currentUser.email, isAdmin: req.currentUser.isAdmin } : null,
    organizations: req.userOrganizations || [],
    currentOrganization: req.currentOrganization || null,
    rights: req.currentUser?.rights || []
  });
});

// Static asset middleware for domain-based routing
app.use('/*', domainStaticMiddleware);

// Static asset middleware for slug-based routing
app.use('/:slug/*', slugStaticMiddleware);

// Slug-based landing serving
app.get('/:slug', serveLandingBySlug);

// Start server
(async () => {
  try {
    await initPersistence();
  } catch (e) {
    console.error('❌ Persistence initialization failed:', e.message);
  }

  app.listen(PORT, () => {
    console.log(`SuperLandings server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    console.log(`Username: ${process.env.ADMIN_USERNAME}`);
  });
})();
