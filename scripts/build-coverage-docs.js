/**
 * Builds a static HTML coverage report site under docs/coverage/.
 *
 * Reads c8 JSON coverage summaries from coverage/unit/ and coverage/functional/,
 * generates an index.html with per-file breakdowns and pass/fail thresholds.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs', 'coverage');

function loadSummary(dir) {
  const file = path.join(ROOT, 'coverage', dir, 'coverage-summary.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function pct(value) {
  return value === undefined ? '0.00' : value.toFixed(2);
}

function fileRow(name, data) {
  const s = data.statements;
  const b = data.branches;
  const f = data.functions;
  const l = data.lines;
  const stmtPct = pct(s.pct);
  const passClass = s.pct >= 50 ? 'pass' : 'fail';
  return `<tr class="${passClass}">
    <td>${name}</td>
    <td>${stmtPct}%</td>
    <td>${s.covered}/${s.total}</td>
    <td>${pct(b.pct)}%</td>
    <td>${pct(f.pct)}%</td>
    <td>${pct(l.pct)}%</td>
  </tr>`;
}

function buildSection(title, summary, threshold) {
  if (!summary) {
    return `<section><h2>${title}</h2><p class="missing">Coverage data not found. Run <code>npm run test:${title.toLowerCase()}</code> first.</p></section>`;
  }

  const total = summary.total;
  const stmtPct = pct(total.statements.pct);
  const passes = total.statements.pct >= threshold;
  const status = passes ? 'PASS' : 'FAIL';
  const statusClass = passes ? 'pass' : 'fail';

  const rows = Object.entries(summary)
    .filter(([k]) => k !== 'total')
    .map(([k, v]) => fileRow(path.relative(ROOT, k), v))
    .join('\n');

  return `<section>
    <h2>${title} <span class="badge ${statusClass}">${status}</span></h2>
    <div class="summary">
      <div class="metric ${statusClass}">
        <span class="metric-value">${stmtPct}%</span>
        <span class="metric-label">Statements</span>
      </div>
      <div class="metric">
        <span class="metric-value">${pct(total.branches.pct)}%</span>
        <span class="metric-label">Branches</span>
      </div>
      <div class="metric">
        <span class="metric-value">${pct(total.functions.pct)}%</span>
        <span class="metric-label">Functions</span>
      </div>
      <div class="metric">
        <span class="metric-value">${pct(total.lines.pct)}%</span>
        <span class="metric-label">Lines</span>
      </div>
    </div>
    <p class="threshold">Threshold: ${threshold}% — ${passes ? 'met' : 'NOT met'}</p>
    <table>
      <thead>
        <tr><th>File</th><th>Stmts %</th><th>Covered/Total</th><th>Branches %</th><th>Functions %</th><th>Lines %</th></tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </section>`;
}

function buildHtml(unitSummary, funcSummary) {
  const unitPass = unitSummary && unitSummary.total.statements.pct >= 50;
  const funcPass = funcSummary && funcSummary.total.statements.pct >= 50;
  const overallPass = unitPass && funcPass;
  const generated = new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Coverage Report — superlandings</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; color: #1a1a1a; padding: 2rem; }
    h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.4rem; margin: 2rem 0 1rem; }
    .subtitle { color: #666; margin-bottom: 2rem; }
    .overall { display: inline-block; padding: 0.3rem 1rem; border-radius: 4px; font-weight: bold; font-size: 1.1rem; margin-bottom: 2rem; }
    .overall.pass { background: #d4edda; color: #155724; }
    .overall.fail { background: #f8d7da; color: #721c24; }
    .badge { display: inline-block; padding: 0.15rem 0.6rem; border-radius: 3px; font-size: 0.8rem; font-weight: bold; }
    .badge.pass { background: #28a745; color: #fff; }
    .badge.fail { background: #dc3545; color: #fff; }
    .summary { display: flex; gap: 1.5rem; margin: 1rem 0; flex-wrap: wrap; }
    .metric { background: #fff; border: 1px solid #dee2e6; border-radius: 6px; padding: 1rem 1.5rem; text-align: center; min-width: 120px; }
    .metric.pass { border-color: #28a745; }
    .metric.fail { border-color: #dc3545; }
    .metric-value { display: block; font-size: 1.8rem; font-weight: bold; }
    .metric-label { display: block; font-size: 0.85rem; color: #666; margin-top: 0.25rem; }
    .threshold { font-size: 0.9rem; color: #666; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #343a40; color: #fff; text-align: left; padding: 0.6rem 0.8rem; font-size: 0.85rem; }
    td { padding: 0.5rem 0.8rem; border-bottom: 1px solid #dee2e6; font-size: 0.85rem; }
    tr.pass { background: #f0fff4; }
    tr.fail { background: #fff5f5; }
    tr:hover { background: #f1f3f5; }
    .missing { color: #dc3545; font-style: italic; }
    code { background: #e9ecef; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.85rem; }
    .footer { margin-top: 3rem; color: #999; font-size: 0.8rem; }
  </style>
</head>
<body>
  <h1>Test Coverage Report</h1>
  <p class="subtitle">superlandings — unit &amp; functional test coverage</p>
  <div class="overall ${overallPass ? 'pass' : 'fail'}">
    ${overallPass ? 'ALL THRESHOLDS MET' : 'THRESHOLDS NOT MET'}
  </div>
  ${buildSection('Unit', unitSummary, 50)}
  ${buildSection('Functional', funcSummary, 50)}
  <p class="footer">Generated: ${generated} — Run <code>npm run test:coverage</code> to regenerate.</p>
</body>
</html>`;
}

// Main
const unitSummary = loadSummary('unit');
const funcSummary = loadSummary('functional');

fs.mkdirSync(DOCS_DIR, { recursive: true });
fs.writeFileSync(path.join(DOCS_DIR, 'index.html'), buildHtml(unitSummary, funcSummary));

// Print summary to console
const unitPct = unitSummary ? pct(unitSummary.total.statements.pct) : 'N/A';
const funcPct = funcSummary ? pct(funcSummary.total.statements.pct) : 'N/A';
console.log(`Coverage docs generated at docs/coverage/index.html`);
console.log(`  Unit:       ${unitPct}% (threshold: 50%)`);
console.log(`  Functional: ${funcPct}% (threshold: 50%)`);
