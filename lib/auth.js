const bcrypt = require('bcryptjs');
const { readDB } = require('./db');

// Available rights for users
const AVAILABLE_RIGHTS = [
  'landings:create',
  'landings:update', 
  'landings:domains',
  'landings:delete'
];

// Hash password
function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

// Verify password
function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// Check if user is admin (basic auth)
function isAdmin(req) {
  return req.adminAuth === true;
}

// Get current user from request
function getCurrentUser(req) {
  return req.currentUser || null;
}

// Get current organization from request
function getCurrentOrganization(req) {
  return req.currentOrganization || null;
}

// Check if user has specific right
function hasRight(user, right) {
  if (!user) return false;
  if (user.isAdmin) return true;
  return user.rights && user.rights.includes(right);
}

// Admin basic auth middleware
function adminBasicAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
  const [username, password] = credentials.split(':');

  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.adminAuth = true;
    req.currentUser = { isAdmin: true, email: 'admin' };
    return next();
  }

  // Try user authentication
  const db = readDB();
  const users = db.users || [];
  const user = users.find(u => u.email === username);

  if (user && verifyPassword(password, user.password)) {
    req.adminAuth = false;
    req.currentUser = user;
    
    // Get user's organizations
    const orgs = db.organizations || [];
    const userOrgs = orgs.filter(o => 
      o.users && o.users.some(u => u.email === user.email)
    );
    req.userOrganizations = userOrgs;
    
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
  return res.status(401).json({ error: 'Invalid credentials' });
}

// Middleware to set current organization from header
function setCurrentOrganization(req, res, next) {
  const orgId = req.headers['x-organization-id'];
  
  if (!orgId) {
    return next();
  }

  const db = readDB();
  const orgs = db.organizations || [];
  const org = orgs.find(o => o.id === orgId);

  if (org) {
    // Admin can access any org
    if (req.adminAuth) {
      req.currentOrganization = org;
      return next();
    }

    // User must belong to the org
    if (org.users && org.users.some(u => u.email === req.currentUser?.email)) {
      req.currentOrganization = org;
      // Get user's rights for this org
      const userInOrg = org.users.find(u => u.email === req.currentUser.email);
      if (userInOrg) {
        req.currentUser.rights = userInOrg.rights || [];
      }
    }
  }

  next();
}

// Middleware to require specific right
function requireRight(right) {
  return (req, res, next) => {
    if (req.adminAuth) return next();
    
    if (!req.currentUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!hasRight(req.currentUser, right)) {
      return res.status(403).json({ error: `Missing required permission: ${right}` });
    }

    next();
  };
}

module.exports = {
  AVAILABLE_RIGHTS,
  hashPassword,
  verifyPassword,
  isAdmin,
  getCurrentUser,
  getCurrentOrganization,
  hasRight,
  adminBasicAuth,
  setCurrentOrganization,
  requireRight
};
