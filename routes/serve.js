const express = require('express');
const path = require('path');
const { readDB, LANDINGS_DIR } = require('../lib/db');

const router = express.Router();

// Middleware: Handle static assets for domain-based routing
function domainStaticMiddleware(req, res, next) {
  const host = req.get('host');
  if (!host) return next();
  
  const db = readDB();
  
  const landing = db.landings.find(l => 
    l.published && l.type === 'static' && l.domains && l.domains.some(domain => 
      domain === host || domain === host.replace(/:\d+$/, '')
    )
  );
  
  if (landing) {
    express.static(path.join(LANDINGS_DIR, landing.slug))(req, res, next);
  } else {
    next();
  }
}

// Middleware: Handle static assets for slug-based routing
function slugStaticMiddleware(req, res, next) {
  const { slug } = req.params;
  const db = readDB();
  const landing = db.landings.find(l => l.slug === slug);
  
  if (landing && landing.type === 'static') {
    express.static(path.join(LANDINGS_DIR, slug))(req, res, next);
  } else {
    next();
  }
}

// Domain-based routing for landing pages (fallback if Traefik addPrefix fails)
function serveLandingByDomain(req, res, next) {
  try {
    const host = req.get('host');
    if (!host) return next();
    
    const db = readDB();
    
    const landing = db.landings.find(l => 
      l.published && l.domains && l.domains.some(domain => 
        domain === host || domain === host.replace(/:\d+$/, '')
      )
    );
    
    if (!landing) return next();

    const landingDir = path.join(LANDINGS_DIR, landing.slug);

    // Disable caching for landing pages
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    if (landing.type === 'html') {
      return res.sendFile(path.join(landingDir, 'index.html'));
    } else if (landing.type === 'static') {
      return res.sendFile(path.join(landingDir, 'index.html'));
    } else if (landing.type === 'ejs') {
      return res.render(path.join(landing.slug, 'index'));
    }
  } catch (error) {
    console.error('Error serving landing:', error);
    res.status(500).send('Error loading landing page');
  }
}

// Serve landing by slug
function serveLandingBySlug(req, res) {
  try {
    const { slug } = req.params;
    const db = readDB();
    
    const landing = db.landings.find(l => l.slug === slug);
    if (!landing) {
      return res.status(404).send('Landing not found');
    }

    const landingDir = path.join(LANDINGS_DIR, slug);

    // Disable caching for landing pages
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
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
}

module.exports = {
  domainStaticMiddleware,
  slugStaticMiddleware,
  serveLandingByDomain,
  serveLandingBySlug
};
