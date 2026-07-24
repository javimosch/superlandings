require('./_sandbox');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Set up browser globals for block definition/compiler files
global.window = {};
global.esc = function(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

// Load block definitions (assigns to global.window.SL_BLOCKS etc.)
require('../ui/js/blocks/definitions.js');
// Load extra block definitions (appends to window.SL_BLOCKS)
require('../ui/js/blocks/extra-definitions-1.js');
require('../ui/js/blocks/extra-definitions-2.js');
// Load compiler (assigns to global.window.SL_COMPILE etc.)
require('../ui/js/blocks/compiler.js');

const { SL_BLOCKS, SL_BLOCK_GET, SL_BLOCK_DEFAULTS, SL_COMPILE, SL_PARSE } = global.window;

// ── Block definitions ──

test('SL_BLOCKS has 44 block definitions', () => {
  assert.equal(SL_BLOCKS.length, 44);
});

test('every block has required fields', () => {
  for (const b of SL_BLOCKS) {
    assert.ok(b.type, `block missing type: ${JSON.stringify(b)}`);
    assert.ok(b.category, `block ${b.type} missing category`);
    assert.ok(b.label, `block ${b.type} missing label`);
    assert.ok(b.icon, `block ${b.type} missing icon`);
    assert.ok(Array.isArray(b.props), `block ${b.type} props not array`);
    assert.equal(typeof b.render, 'function', `block ${b.type} render not function`);
  }
});

test('block types are unique', () => {
  const types = SL_BLOCKS.map(b => b.type);
  const unique = new Set(types);
  assert.equal(types.length, unique.size, 'duplicate block types found');
});

test('blocks cover 6 categories', () => {
  const cats = new Set(SL_BLOCKS.map(b => b.category));
  assert.ok(cats.has('Hero'));
  assert.ok(cats.has('Text'));
  assert.ok(cats.has('Media'));
  assert.ok(cats.has('CTA'));
  assert.ok(cats.has('Social'));
  assert.ok(cats.has('Layout'));
  assert.ok(cats.has('Footer'));
  assert.ok(cats.size >= 6);
});

test('SL_BLOCK_GET returns definition by type', () => {
  const def = SL_BLOCK_GET('hero-centered');
  assert.ok(def);
  assert.equal(def.type, 'hero-centered');
});

test('SL_BLOCK_GET returns undefined for unknown type', () => {
  const def = SL_BLOCK_GET('nonexistent');
  assert.equal(def, undefined);
});

test('SL_BLOCK_DEFAULTS returns object with all prop keys', () => {
  const defaults = SL_BLOCK_DEFAULTS('hero-centered');
  assert.ok(defaults.title);
  assert.ok(defaults.subtitle);
  assert.ok(defaults.bgColor);
  assert.ok(defaults.ctaLabel);
});

test('SL_BLOCK_DEFAULTS returns deep copy (not shared reference)', () => {
  const d1 = SL_BLOCK_DEFAULTS('feature-grid');
  const d2 = SL_BLOCK_DEFAULTS('feature-grid');
  d1.items[0].title = 'Modified';
  assert.notEqual(d1.items[0].title, d2.items[0].title, 'defaults should be deep copies');
});

test('SL_BLOCK_DEFAULTS returns empty object for unknown type', () => {
  const defaults = SL_BLOCK_DEFAULTS('nonexistent');
  assert.deepEqual(defaults, {});
});

// ── Block render functions ──

test('hero-centered render produces section with title', () => {
  const def = SL_BLOCK_GET('hero-centered');
  const html = def.render({ title: 'Hello World', subtitle: 'Test', ctaLabel: 'Click', ctaLink: '#' });
  assert.ok(html.includes('<section'));
  assert.ok(html.includes('Hello World'));
  assert.ok(html.includes('Click'));
});

test('hero-split render includes image tag', () => {
  const def = SL_BLOCK_GET('hero-split');
  const html = def.render({ title: 'T', subtitle: 'S', image: 'https://example.com/img.png', ctaLabel: 'Go' });
  assert.ok(html.includes('<img'));
  assert.ok(html.includes('example.com/img.png'));
});

test('feature-grid render creates grid with items', () => {
  const def = SL_BLOCK_GET('feature-grid');
  const html = def.render({
    title: 'Features', columns: '3',
    items: [
      { icon: '⚡', title: 'Fast', text: 'Quick' },
      { icon: '🔒', title: 'Secure', text: 'Safe' },
      { icon: '📱', title: 'Mobile', text: 'Responsive' },
    ],
  });
  assert.ok(html.includes('grid-template-columns:repeat(3'));
  assert.ok(html.includes('Fast'));
  assert.ok(html.includes('Secure'));
  assert.ok(html.includes('Mobile'));
});

test('testimonials render includes quote text', () => {
  const def = SL_BLOCK_GET('testimonials');
  const html = def.render({
    title: 'Reviews',
    items: [{ quote: 'Great product', name: 'Jane', role: 'CEO' }],
  });
  assert.ok(html.includes('Great product'));
  assert.ok(html.includes('Jane'));
  assert.ok(html.includes('CEO'));
});

test('footer-simple render includes copyright and links', () => {
  const def = SL_BLOCK_GET('footer-simple');
  const html = def.render({
    text: '© 2026 Acme',
    links: [{ label: 'Privacy', url: '/privacy' }],
  });
  assert.ok(html.includes('<footer'));
  assert.ok(html.includes('© 2026 Acme'));
  assert.ok(html.includes('Privacy'));
  assert.ok(html.includes('/privacy'));
});

test('divider render with line style produces hr', () => {
  const def = SL_BLOCK_GET('divider');
  const html = def.render({ style: 'line' });
  assert.ok(html.includes('<hr'));
});

test('divider render with space style produces spacer div', () => {
  const def = SL_BLOCK_GET('divider');
  const html = def.render({ style: 'space' });
  assert.ok(html.includes('height:40px'));
});

test('button-row render creates anchor tags', () => {
  const def = SL_BLOCK_GET('button-row');
  const html = def.render({
    align: 'center',
    buttons: [
      { label: 'Get started', link: '#', style: 'primary' },
      { label: 'Learn more', link: '#about', style: 'secondary' },
    ],
  });
  assert.ok(html.includes('Get started'));
  assert.ok(html.includes('Learn more'));
  assert.ok(html.includes('#about'));
});

test('render functions escape HTML in user content (XSS prevention)', () => {
  const def = SL_BLOCK_GET('heading');
  const html = def.render({ text: '<script>alert(1)</script>', level: 'h2', align: 'left' });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('image render includes alt text', () => {
  const def = SL_BLOCK_GET('image');
  const html = def.render({ src: 'https://example.com/img.png', alt: 'Description', caption: 'Cap' });
  assert.ok(html.includes('alt="Description"'));
  assert.ok(html.includes('Cap'));
});

test('raw-html render preserves custom markup', () => {
  const def = SL_BLOCK_GET('raw-html');
  const html = def.render({ html: '<section style="background:red"><h1>Custom</h1></section>' });
  assert.ok(html.includes('<section style="background:red">'));
  assert.ok(html.includes('<h1>Custom</h1>'));
});

test('pricing render includes all three plans', () => {
  const def = SL_BLOCK_GET('pricing');
  const html = def.render({
    title: 'Pricing',
    plans: [
      { name: 'Starter', price: '$9', period: '/mo', features: 'A\nB', cta: 'Buy', highlighted: '' },
      { name: 'Pro', price: '$29', period: '/mo', features: 'C\nD', cta: 'Buy', highlighted: 'true' },
    ],
  });
  assert.ok(html.includes('Pricing'));
  assert.ok(html.includes('Starter'));
  assert.ok(html.includes('Pro'));
  assert.ok(html.includes('$29'));
});

test('contact-form render includes inputs and submit button', () => {
  const def = SL_BLOCK_GET('contact-form');
  const html = def.render({
    title: 'Contact us',
    fields: [
      { label: 'Name', type: 'text', required: 'true' },
      { label: 'Email', type: 'email', required: 'true' },
      { label: 'Message', type: 'textarea', required: 'true' },
    ],
    submitLabel: 'Send',
  });
  assert.ok(html.includes('Contact us'));
  assert.ok(html.includes('type="email"'));
  assert.ok(html.includes('Send'));
});

test('faq render creates details/summary accordion', () => {
  const def = SL_BLOCK_GET('faq');
  const html = def.render({
    title: 'FAQ',
    items: [
      { question: 'What?', answer: 'That.' },
      { question: 'Why?', answer: 'Because.' },
    ],
  });
  assert.ok(html.includes('FAQ'));
  assert.ok(html.includes('<details'));
  assert.ok(html.includes('<summary'));
  assert.ok(html.includes('What?'));
});

// ── Extra blocks spot checks ──

test('new extra blocks render expected markup', () => {
  assert.ok(SL_BLOCK_GET('hero-video').render({ title: 'T', videoUrl: 'x.mp4' }).includes('<video'));
  assert.ok(SL_BLOCK_GET('stats-row').render({ stats: [{ label: 'A', value: '1' }] }).includes('1'));
  assert.ok(SL_BLOCK_GET('newsletter').render({ title: 'N' }).includes('type="email"'));
  assert.ok(SL_BLOCK_GET('comparison-table').render({ plans: [{ name: 'P' }], features: [{ name: 'F' }] }).includes('<table'));
  assert.ok(SL_BLOCK_GET('team-grid').render({ members: [{ name: 'A', photo: 'a.jpg' }] }).includes('a.jpg'));
  assert.ok(SL_BLOCK_GET('navbar').render({ brand: 'B', links: [{ label: 'H', url: '#' }] }).includes('<nav'));
  assert.ok(SL_BLOCK_GET('marquee').render({ text: 'M' }).includes('marquee'));
  assert.ok(SL_BLOCK_GET('feature-list').render({ items: [{ title: 'T', description: 'D', icon: '⚡' }] }).includes('⚡'));
});

// ── Compiler ──

test('SL_COMPILE produces valid HTML document', () => {
  const html = SL_COMPILE([
    { type: 'hero-centered', props: { title: 'Test', subtitle: 'Sub' } },
  ]);
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.includes('<html'));
  assert.ok(html.includes('</html>'));
  assert.ok(html.includes('<head>'));
  assert.ok(html.includes('<body>'));
});

test('SL_COMPILE includes responsive CSS', () => {
  const html = SL_COMPILE([{ type: 'divider', props: { style: 'line' } }]);
  assert.ok(html.includes('@media'));
  assert.ok(html.includes('max-width: 768px'));
});

test('SL_COMPILE returns empty string for empty array', () => {
  assert.equal(SL_COMPILE([]), '');
});

test('SL_COMPILE returns empty string for null input', () => {
  assert.equal(SL_COMPILE(null), '');
});

test('SL_COMPILE returns empty string for undefined input', () => {
  assert.equal(SL_COMPILE(undefined), '');
});

test('SL_COMPILE handles unknown block types gracefully', () => {
  const html = SL_COMPILE([{ type: 'nonexistent', props: {} }]);
  assert.ok(html.includes('unknown block'));
  assert.ok(html.startsWith('<!DOCTYPE html>'));
});

test('SL_COMPILE combines multiple blocks in order', () => {
  const html = SL_COMPILE([
    { type: 'hero-centered', props: { title: 'FIRST' } },
    { type: 'footer-simple', props: { text: 'LAST' } },
  ]);
  const firstIdx = html.indexOf('FIRST');
  const lastIdx = html.indexOf('LAST');
  assert.ok(firstIdx > -1);
  assert.ok(lastIdx > -1);
  assert.ok(firstIdx < lastIdx, 'blocks should be in order');
});

test('SL_COMPILE includes system font in base CSS', () => {
  const html = SL_COMPILE([{ type: 'divider', props: { style: 'line' } }]);
  assert.ok(html.includes('font-family'));
  assert.ok(html.includes('BlinkMacSystemFont') || html.includes('Segoe UI'));
});

test('SL_PARSE returns null for non-block HTML', () => {
  assert.equal(SL_PARSE('<html><body>regular page</body></html>'), null);
});

test('SL_PARSE returns null for empty input', () => {
  assert.equal(SL_PARSE(''), null);
  assert.equal(SL_PARSE(null), null);
});

test('SL_PARSE round-trips block-editor generated HTML', () => {
  const blocks = [
    { type: 'hero-centered', props: { title: 'Hello world', subtitle: 'A subtitle', ctaLabel: 'Go', ctaLink: '#go' } },
    { type: 'paragraph', props: { text: 'Some body copy.', align: 'left' } },
  ];
  const html = SL_COMPILE(blocks);
  const parsed = SL_PARSE(html);
  assert.ok(parsed, 'should parse generated HTML');
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].type, 'hero-centered');
  assert.ok(parsed[0].props.title.includes('Hello world'));
  assert.equal(parsed[1].type, 'paragraph');
  assert.ok(parsed[1].props.text.includes('Some body copy'));
});

test('SL_PARSE preserves generic landing HTML as raw-html blocks', () => {
  const html = `<!DOCTYPE html><html><head><style>body{color:#333}</style></head><body>
    <section style="background:#0a0a0a;color:#fff;text-align:center;padding:80px 20px">
      <h1>My Product</h1>
      <p>The best product ever.</p>
      <a href="#buy" style="background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px">Buy now</a>
    </section>
    <section style="padding:60px 20px">
      <h2>Features</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">
        <div><h3>Fast</h3><p>Lightning quick</p></div>
        <div><h3>Secure</h3><p>Bank-grade</p></div>
        <div><h3>Mobile</h3><p>Works everywhere</p></div>
      </div>
    </section>
  </body></html>`;
  const parsed = SL_PARSE(html);
  assert.ok(parsed, 'should parse');
  assert.ok(parsed.length >= 2, 'should produce raw-html blocks');
  assert.equal(parsed[0].type, 'raw-html');
  assert.ok(parsed[0].props.html.includes('<style>'), 'should preserve custom styles');
  assert.equal(parsed[1].type, 'raw-html');
  assert.ok(parsed[1].props.html.includes('My Product'), 'should preserve hero section');
  // Recompiling should reproduce the original markup (styles + sections)
  const compiled = SL_COMPILE(parsed);
  assert.ok(compiled.includes('My Product'));
  assert.ok(compiled.includes('Lightning quick'));
  assert.ok(compiled.includes('<style>'));
});

// ── Integration: full page compile ──

test('full page compile with all block types produces valid HTML', () => {
  const blocks = SL_BLOCKS.map(b => ({
    type: b.type,
    props: SL_BLOCK_DEFAULTS(b.type),
  }));
  const html = SL_COMPILE(blocks);
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.includes('</html>'));
  assert.ok(html.length > 1000, 'compiled page should be substantial');
  // Verify no unescaped script tags from default content
  assert.ok(!html.includes('<script>alert'), 'no unescaped script injection');
});
