/* Block compiler — converts block JSON array to standalone HTML page
   Usage: window.SL_COMPILE(blocks) → HTML string
   blocks = [{ type: 'hero-centered', props: {...} }, ...] */

window.SL_COMPILE = function(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';

  const sections = blocks.map((block, index) => {
    const def = window.SL_BLOCK_GET(block.type);
    if (!def) return `<!-- unknown block: ${block.type} -->`;
    // Mark the root element with data-sl-block + stable index for preview DOM diffing
    return def.render(block.props || {}).replace(/^<([a-zA-Z0-9-]+)/i, `<$1 data-sl-block="${esc(block.type)}" data-sl-block-idx="${index}"`);
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Landing page</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; line-height: 1.5; }
    img { max-width: 100%; height: auto; }
    a { transition: opacity 0.2s; }
    a:hover { opacity: 0.85; }
    @media (max-width: 768px) {
      h1 { font-size: 32px !important; }
      h2 { font-size: 24px !important; }
    }
  </style>
</head>
<body>
${sections}
</body>
</html>`;
};

// Helper: extract text inside the first matching tag (regex-based)
function extractText(content, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = content.match(re);
  return m ? m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

// Helper: decode HTML entities in attribute values
function decodeAttr(s) {
  return String(s || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");
}

// Helper: strip the data-sl-block attribute from a tag string
function stripDataSlBlock(html) {
  return html.replace(/\sdata-sl-block="[^"]*"/gi, '');
}

// Reverse: parse HTML back to block JSON (best-effort)
// Works for block-editor-generated HTML (data-sl-block markers) and generic landing HTML.
window.SL_PARSE = function(html) {
  if (!html) return null;

  // First, if the HTML has block-editor markers, round-trip it.
  if (html.includes('data-sl-block')) {
    return parseBlockGenerated(html);
  }

  // Otherwise, preserve the original look by creating raw-html blocks per top-level element.
  return parseGeneric(html);
};

// Parse block-generated HTML (with data-sl-block markers) into typed blocks
function parseBlockGenerated(html) {
  let body = html;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) body = bodyMatch[1];

  // Remove scripts/styles (they are added by the compiler)
  body = body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');

  const blocks = [];
  const tagRe = /<([a-zA-Z0-9-]+)[^>]*data-sl-block="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = tagRe.exec(body)) !== null) {
    const [, rootTag, type, inner] = m;
    const full = `<${rootTag} data-sl-block="${type}">${inner}</${rootTag}>`;
    const parsed = parseSection(type, full, inner);
    if (parsed) blocks.push(parsed);
  }
  return blocks.length ? blocks : null;
}

// Parse a known block section into props
function parseSection(type, full, inner) {
  const def = window.SL_BLOCK_GET(type);
  if (!def) {
    // Unknown block type: preserve as raw HTML so nothing is lost
    return { type: 'raw-html', props: { html: stripDataSlBlock(full) } };
  }

  const props = window.SL_BLOCK_DEFAULTS(type);

  // raw-html blocks preserve the original markup
  if (type === 'raw-html') {
    props.html = stripDataSlBlock(full);
    return { type, props };
  }

  // Extract common text props
  const h1 = extractText(inner, 'h1');
  const h2 = extractText(inner, 'h2');
  const firstH = h1 || h2;
  const firstP = extractText(inner, 'p');
  const imgMatch = inner.match(/<img[^>]+src="([^"]+)"/i);
  const bgMatch = full.match(/background:\s*([^;"]+)/i);
  const colorMatch = full.match(/color:\s*([^;"\s]+)/i);

  // Try to fill known props
  if ('title' in props) props.title = firstH || props.title;
  if ('subtitle' in props) {
    const ps = [...inner.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
    const sub = ps.find(p => !p[1].includes('<a') && p[1].replace(/<[^>]+>/g, '').trim());
    props.subtitle = sub ? sub[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : firstP;
  }
  if ('text' in props) props.text = firstP || h2 || props.text;
  if ('image' in props && imgMatch) props.image = decodeAttr(imgMatch[1]);
  if ('src' in props && imgMatch) props.src = decodeAttr(imgMatch[1]);
  if ('bgColor' in props && bgMatch) props.bgColor = bgMatch[1].trim();
  if ('textColor' in props && colorMatch) props.textColor = colorMatch[1].trim();

  // CTA button extraction
  const ctaMatch = inner.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  if (ctaMatch) {
    if ('ctaLink' in props) props.ctaLink = decodeAttr(ctaMatch[1]);
    if ('ctaLabel' in props) props.ctaLabel = ctaMatch[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Feature grid items
  if (type === 'feature-grid') {
    const items = [];
    const divs = inner.split(/<div[^>]*>/i).slice(1);
    for (const div of divs) {
      const txt = extractText(div, 'h3') || extractText(div, 'h4') || extractText(div, 'strong');
      if (!txt) continue;
      const body = extractText(div, 'p');
      const icon = div.match(/<div[^>]*style="[^"]*font-size:\s*36px[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      items.push({ icon: icon ? icon[1].replace(/<[^>]+>/g, '').trim() : '•', title: txt, text: body });
    }
    if (items.length) props.items = items.slice(0, 6);
    if (h2) props.title = h2;
  }

  // Testimonials
  if (type === 'testimonials') {
    const items = [];
    const quotes = [...inner.matchAll(/<p[^>]*style="[^"]*font-style:\s*italic[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)];
    for (const q of quotes) {
      const quote = q[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!quote) continue;
      const after = inner.slice(q.index + q[0].length, q.index + q[0].length + 400);
      const name = extractText(after, 'div') || '';
      const parts = name.split(',').map(s => s.trim());
      items.push({ quote, name: parts[0] || '', role: parts[1] || '' });
    }
    if (items.length) props.items = items;
    if (h2) props.title = h2;
  }

  // Footer links
  if (type === 'footer-simple') {
    const links = [];
    const linkMatches = [...inner.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    for (const lm of linkMatches) {
      links.push({ label: lm[2].replace(/<[^>]+>/g, ' ').trim(), url: decodeAttr(lm[1]) });
    }
    if (links.length) props.links = links;
    const pText = extractText(inner, 'p');
    if (pText && 'text' in props) props.text = pText;
  }

  // Button row
  if (type === 'button-row') {
    const buttons = [];
    const linkMatches = [...inner.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    for (const lm of linkMatches) {
      buttons.push({ label: lm[2].replace(/<[^>]+>/g, ' ').trim(), link: decodeAttr(lm[1]), style: lm[0].includes('background:transparent') ? 'secondary' : 'primary' });
    }
    if (buttons.length) props.buttons = buttons;
  }

  // Heading level
  if ('level' in props) {
    if (h1) props.level = 'h1';
    else if (h2) props.level = 'h2';
    else props.level = 'h3';
  }
  if ('align' in props) {
    const alignMatch = full.match(/text-align:\s*(left|center|right)/i);
    props.align = alignMatch ? alignMatch[1] : 'left';
  }

  return { type, props };
}

// Heuristic parser for generic landing pages
// Strategy: preserve the original visual look by creating raw-html blocks for each
// top-level element. This avoids style loss and gives the user editable, movable chunks.
function parseGeneric(html) {
  // Use DOMParser if available (browser) for reliable top-level extraction
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const blocks = [];

      // Preserve custom styles from <head> as a raw-html block
      const styleTags = Array.from(doc.head.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('\n');
      if (styleTags.trim()) {
        blocks.push({ type: 'raw-html', props: { html: styleTags } });
      }

      // Walk direct body children and create raw-html blocks.
      // If the body has a single wrapper <div>/<main>/<article> that contains sections,
      // unwrap it so users get editable chunks instead of one big block.
      let children = Array.from(doc.body.children);
      if (children.length === 1) {
        const only = children[0];
        const onlyTag = only.tagName.toLowerCase();
        if (['div','main','article'].includes(onlyTag) && only.querySelector('section, article, div, header, footer, main')) {
          children = Array.from(only.children);
        }
      }

      for (const child of children) {
        const tag = child.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style') continue;
        const outer = child.outerHTML;
        if (outer && outer.trim().length > 10) {
          blocks.push({ type: 'raw-html', props: { html: outer } });
        }
      }

      return blocks.length ? blocks : null;
    } catch (err) {
      // Fall through to regex fallback
    }
  }

  // Regex fallback for non-browser environments (e.g. Node tests)
  return parseGenericRegex(html);
}

// Regex fallback for parseGeneric — used in Node.js / tests
function parseGenericRegex(html) {
  const blocks = [];

  // Extract styles from <head>
  const styleRe = /<style[\s\S]*?<\/style>/gi;
  const styles = [];
  let sm;
  while ((sm = styleRe.exec(html)) !== null) styles.push(sm[0]);
  if (styles.length) blocks.push({ type: 'raw-html', props: { html: styles.join('\n') } });

  // Extract body content
  let body = html;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) body = bodyMatch[1];

  // Remove scripts/styles from body
  body = body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');

  // Find top-level section/footer/header/main/article tags (assume no same-name nesting)
  const topLevelRe = /<(section|footer|header|main|article|div)[^>]*>[\s\S]*?<\/\1>/gi;
  let m;
  while ((m = topLevelRe.exec(body)) !== null) {
    const outer = m[0];
    if (outer.trim().length > 20) blocks.push({ type: 'raw-html', props: { html: outer } });
  }

  return blocks.length ? blocks : null;
}
