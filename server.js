require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');

// Local modules
const { ensureDirectories, DATA_DIR, LANDINGS_DIR } = require('./lib/db');
const { adminBasicAuth, setCurrentOrganization } = require('./lib/auth');
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

// Admin panel route (EJS)
app.get('/admin', adminBasicAuth, (req, res) => {
  res.render('admin/index');
});

// API routes with auth and organization context
app.use('/api/landings', adminBasicAuth, setCurrentOrganization, upload.array('files'), landingsRouter);
app.use('/api/admin-config', adminBasicAuth, adminConfigRouter);
app.use('/api/organizations', adminBasicAuth, organizationsRouter);
app.use('/api/users', adminBasicAuth, usersRouter);
app.use('/api/migration', adminBasicAuth, migrationRouter);

// Auth info endpoint
app.get('/api/auth/me', adminBasicAuth, setCurrentOrganization, (req, res) => {
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

// Domain-based landing serving (root path)
app.get('/', serveLandingByDomain);

// Default admin route (fallback for root)
app.get('/', adminBasicAuth, (req, res) => {
  res.render('admin/index');
});

// Slug-based landing serving
app.get('/:slug', serveLandingBySlug);

// Start server
app.listen(PORT, () => {
  console.log(`SuperLandings server running on http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`Username: ${process.env.ADMIN_USERNAME}`);
});
