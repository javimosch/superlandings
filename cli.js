#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_DIR = path.join(__dirname, 'data');
const LANDINGS_DIR = path.join(DATA_DIR, 'landings');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(LANDINGS_DIR)) fs.mkdirSync(LANDINGS_DIR);
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ landings: [] }, null, 2));
}

function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function addLanding(slug, name, htmlFilePath) {
  const db = readDB();

  // Check if slug already exists
  if (db.landings.find(l => l.slug === slug)) {
    console.error(`Error: Slug "${slug}" already exists!`);
    process.exit(1);
  }

  // Check if HTML file exists
  if (!fs.existsSync(htmlFilePath)) {
    console.error(`Error: HTML file "${htmlFilePath}" not found!`);
    process.exit(1);
  }

  // Create landing directory
  const landingDir = path.join(LANDINGS_DIR, slug);
  if (!fs.existsSync(landingDir)) {
    fs.mkdirSync(landingDir, { recursive: true });
  }

  // Copy HTML file
  const htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
  fs.writeFileSync(path.join(landingDir, 'index.html'), htmlContent);

  // Add to database
  const landing = {
    id: Date.now().toString(),
    slug,
    name: name || slug,
    type: 'html',
    createdAt: new Date().toISOString()
  };

  db.landings.push(landing);
  writeDB(db);

  console.log(`✅ Landing "${name || slug}" created successfully!`);
  console.log(`   URL: /${slug}`);
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: npm run cli <slug> <html-file> [name]');
  console.log('Example: npm run cli crevisto ./crevisto.html "Crevisto Landing"');
  process.exit(1);
}

const slug = args[0];
const htmlFilePath = path.resolve(args[1]);
const name = args[2] || slug;

addLanding(slug, name, htmlFilePath);
