/* Startup cron job hygiene — makes existing DB cron jobs point at the current PORT
   and disables experiment crons that are not deployed. */
const { getCollection, getEngine } = require('./store');

const EXPERIMENT_PREFIXES = ['Experiments:', 'Experiment '];
const LOCALHOST_PORT_RE = /http:\/\/(localhost|127\.0\.0\.1):\d+/g;

async function fixCronJobs(port) {
  if (getEngine() !== 'mongo') return { updated: 0, deleted: 0, skipped: 'json-engine' };

  const baseUrl = `http://localhost:${port}`;
  let updated = 0;
  let deleted = 0;

  try {
    const cronJobs = await getCollection('cron_jobs');

    // 1. Rewrite localhost/127.0.0.1:<port> URLs to the current server port
    const jobs = await cronJobs.find({ taskType: 'http' }).toArray();
    for (const job of jobs) {
      if (!job.httpUrl || !LOCALHOST_PORT_RE.test(job.httpUrl)) continue;
      const newUrl = job.httpUrl.replace(LOCALHOST_PORT_RE, baseUrl);
      if (newUrl !== job.httpUrl) {
        await cronJobs.updateOne({ _id: job._id }, { $set: { httpUrl: newUrl } });
        updated++;
      }
    }

    // 2. Delete any experiment-related cron jobs (not used in SuperLandings)
    const prefixPattern = EXPERIMENT_PREFIXES.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const deleteByPrefix = await cronJobs.deleteMany({
      name: { $regex: `^(${prefixPattern})` },
    });
    deleted += deleteByPrefix.deletedCount || 0;

    // 3. Also delete by exact known names (defensive)
    const exactNames = ['Experiments: Aggregate + Evaluate Winner', 'Experiments: Retention Cleanup'];
    const deleteExact = await cronJobs.deleteMany({ name: { $in: exactNames } });
    deleted += deleteExact.deletedCount || 0;

    if (updated || deleted) {
      console.log(`[CronFix] Rewrote ${updated} cron URL(s) to ${baseUrl}, deleted ${deleted} experiment cron(s).`);
    }
    return { updated, deleted };
  } catch (err) {
    console.error('[CronFix] Failed to fix cron jobs:', err.message);
    return { updated, deleted, error: err.message };
  }
}

module.exports = { fixCronJobs };
