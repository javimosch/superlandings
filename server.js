console.log('MODE', process.env.MODE || 'development');

// Preserve env vars explicitly set on the command line — env files should not override them
const CLI_ENV = { PORT: process.env.PORT };

require('dotenv').config({ path: `.env.${process.env.MODE}` || '.env' });

const fs = require('fs');

if (fs.existsSync(`.env.${process.env.MODE}.local`)) {
  console.log(`Loading .env.${process.env.MODE}.local`);
  const localEnv = fs.readFileSync(`.env.${process.env.MODE}.local`, 'utf8');
  const localEnvVars = localEnv.split('\n').reduce((acc, line) => {
    // Skip comments and empty lines
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return acc;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) return acc;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    // Strip inline comments (e.g., VALUE=foo # comment) — but not inside URLs
    const commentIdx = value.indexOf(' #');
    if (commentIdx !== -1) value = value.slice(0, commentIdx).trim();
    if (key && value) {
      acc[key] = value;
      console.log(`Loaded local env var: ${key}=${value.length > 40 ? value.slice(0, 40) + '…' : value}`);
    }
    return acc;
  }, {});
  Object.assign(process.env, localEnvVars);
}

console.log('NODE_ENV', process.env.NODE_ENV);

// Restore CLI env vars so command-line values take precedence over env files
if (CLI_ENV.PORT) process.env.PORT = CLI_ENV.PORT;

const { initPersistence } = require('./lib/store');
const { createApp } = require('./app');
const { fixCronJobs } = require('./lib/cron-fix');

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await initPersistence();
  } catch (e) {
    console.error('Persistence initialization failed:', e.message);
  }

  await fixCronJobs(PORT);

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`SuperLandings server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    console.log(`Username: ${process.env.ADMIN_USERNAME}`);
  });
})();
