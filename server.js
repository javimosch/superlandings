require('dotenv').config();
const express = require('express');
const basicAuth = require('express-basic-auth');
const multer = require('multer');
const path = require('path');

// Local modules
const { ensureDirectories, DATA_DIR, LANDINGS_DIR } = require('./lib/db');
const landingsRouter = require('./routes/landings');
const adminConfigRouter = require('./routes/admin-config');
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

// Basic auth for admin
const adminAuth = basicAuth({
  users: { [process.env.ADMIN_USERNAME]: process.env.ADMIN_PASSWORD },
  challenge: true
});

// Admin panel route (EJS)
app.get('/admin', adminAuth, (req, res) => {
  res.render('admin/index');
});

// API routes
app.use('/api/landings', adminAuth, upload.array('files'), landingsRouter);
app.use('/api/admin-config', adminAuth, adminConfigRouter);

// Static asset middleware for domain-based routing
app.use('/*', domainStaticMiddleware);

// Static asset middleware for slug-based routing
app.use('/:slug/*', slugStaticMiddleware);

// Domain-based landing serving (root path)
app.get('/', serveLandingByDomain);

// Default admin route (fallback for root)
app.get('/', adminAuth, (req, res) => {
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
