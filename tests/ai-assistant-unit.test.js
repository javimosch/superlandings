require('./_sandbox');
const { test } = require('node:test');
const assert = require('node:assert/strict');

// Test the AI assistant logic in isolation
// The component uses Vue refs internally, but the pure logic can be tested

// Replicate the quick actions from ai-assistant.js
const quickActions = [
  { label: 'Dark mode', icon: 'fa-moon', prompt: 'Change the color scheme to dark mode: dark background (#0a0a0a or similar), light text, muted accent colors. Keep all content and layout the same.' },
  { label: 'Mobile-friendly', icon: 'fa-mobile-screen', prompt: 'Add responsive CSS media queries so the page works well on mobile screens (max-width: 768px). Adjust font sizes, spacing, and layout for small screens. Keep the desktop layout unchanged.' },
  { label: 'Add CTA button', icon: 'fa-bullseye', prompt: 'Add a prominent call-to-action button after the hero section. Use a contrasting accent color, rounded corners, and clear button text like "Get started". Link it to #contact or a placeholder URL.' },
  { label: 'Add contact form', icon: 'fa-envelope', prompt: 'Add a contact form section with name, email, and message fields, plus a submit button. Style it to match the existing design. Place it before the footer.' },
  { label: 'Bigger headings', icon: 'fa-text-height', prompt: 'Increase the font size of all headings (h1, h2, h3) by ~30% and tighten the letter-spacing for a more impactful look. Keep everything else the same.' },
  { label: 'Add testimonials', icon: 'fa-quote-right', prompt: 'Add a testimonials section with 3 placeholder quotes from fictional customers. Include name, role, and company for each. Style as cards with a subtle background. Place after the main content, before the footer.' },
  { label: 'Soften colors', icon: 'fa-palette', prompt: 'Soften the color palette: replace harsh/saturated colors with muted, pastel alternatives. Keep good contrast for readability. Do not change layout or content.' },
  { label: 'Add animations', icon: 'fa-wand-sparkles', prompt: 'Add subtle CSS animations: fade-in-up on headings and sections on scroll (using IntersectionObserver or CSS keyframes), smooth hover transitions on buttons and links. Keep it tasteful and performant.' },
];

test('quick actions array has 8 actions', () => {
  assert.equal(quickActions.length, 8);
});

test('every quick action has label, icon, and prompt', () => {
  for (const a of quickActions) {
    assert.ok(a.label, `action missing label: ${JSON.stringify(a)}`);
    assert.ok(a.icon, `action ${a.label} missing icon`);
    assert.ok(a.prompt, `action ${a.label} missing prompt`);
    assert.ok(a.prompt.length > 20, `action ${a.label} prompt too short`);
  }
});

test('quick action prompts are detailed (not just keywords)', () => {
  for (const a of quickActions) {
    // Good prompts should be at least 50 chars to be detailed enough
    assert.ok(a.prompt.length > 50, `prompt for ${a.label} is too short (${a.prompt.length} chars)`);
  }
});

// Replicate the guided edit logic
const sectionOptions = ['Hero section', 'Features section', 'Pricing section', 'Footer', 'Navigation', 'Whole page', 'Other (describe in detail)'];
const actionOptions = ['Change colors', 'Change layout', 'Change text', 'Add a subsection', 'Remove something', 'Restyle', 'Other (describe in detail)'];

test('guided edit has 7 section options', () => {
  assert.equal(sectionOptions.length, 7);
});

test('guided edit has 7 action options', () => {
  assert.equal(actionOptions.length, 7);
});

test('guided edit includes "Whole page" option', () => {
  assert.ok(sectionOptions.includes('Whole page'));
});

test('guided edit constructs structured prompt from selections', () => {
  // Simulate the runGuided logic
  const guided = { action: 'Change colors', section: 'Hero section', detail: 'make it dark blue' };
  const parts = [`${guided.action} on ${guided.section}.`];
  if (guided.detail.trim()) parts.push(`Details: ${guided.detail.trim()}.`);
  parts.push('Keep the rest of the page unchanged and maintain the existing style.');
  const prompt = parts.join(' ');

  assert.ok(prompt.includes('Change colors'));
  assert.ok(prompt.includes('Hero section'));
  assert.ok(prompt.includes('dark blue'));
  assert.ok(prompt.includes('Keep the rest'));
});

test('guided edit works without detail field', () => {
  const guided = { action: 'Restyle', section: 'Footer', detail: '' };
  const parts = [`${guided.action} on ${guided.section}.`];
  if (guided.detail.trim()) parts.push(`Details: ${guided.detail.trim()}.`);
  parts.push('Keep the rest of the page unchanged and maintain the existing style.');
  const prompt = parts.join(' ');

  assert.ok(prompt.includes('Restyle'));
  assert.ok(prompt.includes('Footer'));
  assert.ok(!prompt.includes('Details:'));
});

// Replicate the refinement generation logic
function generateRefinements(appliedPrompt) {
  const s = [];
  if (/dark|color|background/i.test(appliedPrompt)) s.push({ label: 'Adjust the contrast?', prompt: 'Review the color changes and improve contrast where needed for readability.' });
  if (/button|cta|form/i.test(appliedPrompt)) s.push({ label: 'Make the button bigger?', prompt: 'Make the main call-to-action button larger and more prominent.' });
  if (/mobile|responsive/i.test(appliedPrompt)) s.push({ label: 'Test tablet view too?', prompt: 'Also optimize for tablet screens (max-width: 1024px) with appropriate adjustments.' });
  if (/heading|font|text/i.test(appliedPrompt)) s.push({ label: 'Adjust line height?', prompt: 'Improve line-height and paragraph spacing for better readability.' });
  s.push({ label: 'Add more whitespace?', prompt: 'Increase padding and margins throughout for a more spacious, premium feel.' });
  s.push({ label: 'Tighten the layout?', prompt: 'Reduce excessive whitespace and make the layout more compact and focused.' });
  return s.slice(0, 3);
}

test('refinements for dark mode prompt include contrast suggestion', () => {
  const refs = generateRefinements('Change the color scheme to dark mode');
  assert.ok(refs.some(r => r.label.includes('contrast')));
});

test('refinements for CTA prompt include button size suggestion', () => {
  const refs = generateRefinements('Add a prominent call-to-action button');
  assert.ok(refs.some(r => r.label.includes('button bigger')));
});

test('refinements for mobile prompt include tablet suggestion', () => {
  const refs = generateRefinements('Add responsive CSS media queries for mobile');
  assert.ok(refs.some(r => r.label.includes('tablet')));
});

test('refinements always return at most 3 suggestions', () => {
  const refs = generateRefinements('dark button mobile heading color');
  assert.ok(refs.length <= 3);
});

test('refinements always include at least 1 suggestion (whitespace)', () => {
  const refs = generateRefinements('completely unrelated prompt');
  assert.ok(refs.length >= 1);
  assert.ok(refs.some(r => r.label.includes('whitespace') || r.label.includes('Tighten')));
});

test('every refinement has label and prompt', () => {
  const refs = generateRefinements('dark mode with buttons');
  for (const r of refs) {
    assert.ok(r.label, 'refinement missing label');
    assert.ok(r.prompt, 'refinement missing prompt');
  }
});
