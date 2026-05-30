const { spawn } = require('child_process');
const path = require('path');

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
      if (err.code === 'ENOENT') {
        reject(new Error(`Command "${command}" not found. Please ensure it is installed and in your PATH.`));
      } else {
        reject(err);
      }
    });
  });
}

// Validate slug to prevent path traversal attacks
function isValidSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9][a-z0-9\-_]*$/i.test(slug);
}

// Safely join a slug path, validating that it doesn't escape the base directory
function safeSlugPath(baseDir, slug) {
  if (!isValidSlug(slug)) {
    throw new Error(`Invalid slug: ${slug}`);
  }
  return path.join(baseDir, slug);
}

module.exports = {
  execCommand,
  isValidSlug,
  safeSlugPath
};
