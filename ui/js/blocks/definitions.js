/* Block definitions — schema + render function for each block type
   Used by block-editor.js (editing UI) and compiler.js (JSON→HTML)
   Each block: { type, category, label, icon, props: [{key,label,type,default,options?}], render(props) } */

window.SL_BLOCKS = [
  // ── Hero ──
  {
    type: 'hero-centered', category: 'Hero', label: 'Hero — centered', icon: 'fa-bullhorn',
    props: [
      { key: 'title', label: 'Title', type: 'text', default: 'Your headline here' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'A short description of what you offer' },
      { key: 'bgColor', label: 'Background color', type: 'color', default: '#0a0a0a' },
      { key: 'textColor', label: 'Text color', type: 'color', default: '#ffffff' },
      { key: 'ctaLabel', label: 'Button label', type: 'text', default: 'Get started' },
      { key: 'ctaLink', label: 'Button link', type: 'text', default: '#contact' },
    ],
    render(p) {
      const cta = p.ctaLabel ? `<a href="${esc(p.ctaLink||'#')}" style="display:inline-block;margin-top:24px;padding:14px 32px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px">${esc(p.ctaLabel)}</a>` : '';
      return `<section style="background:${esc(p.bgColor||'#0a0a0a')};color:${esc(p.textColor||'#fff')};text-align:center;padding:80px 20px">
        <div style="max-width:720px;margin:0 auto">
          <h1 style="font-size:48px;font-weight:800;line-height:1.1;margin:0 0 16px">${esc(p.title||'')}</h1>
          <p style="font-size:20px;opacity:0.8;margin:0 0 24px">${esc(p.subtitle||'')}</p>
          ${cta}
        </div>
      </section>`;
    },
  },
  {
    type: 'hero-split', category: 'Hero', label: 'Hero — split image', icon: 'fa-columns',
    props: [
      { key: 'title', label: 'Title', type: 'text', default: 'Build something great' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'A short description of your product' },
      { key: 'image', label: 'Image URL', type: 'text', default: 'https://placehold.co/600x400' },
      { key: 'ctaLabel', label: 'Button label', type: 'text', default: 'Learn more' },
      { key: 'ctaLink', label: 'Button link', type: 'text', default: '#about' },
    ],
    render(p) {
      const cta = p.ctaLabel ? `<a href="${esc(p.ctaLink||'#')}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">${esc(p.ctaLabel)}</a>` : '';
      return `<section style="display:flex;align-items:center;gap:40px;padding:60px 20px;max-width:1100px;margin:0 auto;flex-wrap:wrap">
        <div style="flex:1;min-width:300px">
          <h1 style="font-size:40px;font-weight:800;line-height:1.1;margin:0 0 12px">${esc(p.title||'')}</h1>
          <p style="font-size:18px;color:#666;margin:0 0 20px">${esc(p.subtitle||'')}</p>
          ${cta}
        </div>
        <div style="flex:1;min-width:300px"><img src="${esc(p.image||'')}" alt="" style="width:100%;border-radius:12px;display:block"></div>
      </section>`;
    },
  },

  // ── Text ──
  {
    type: 'heading', category: 'Text', label: 'Heading', icon: 'fa-heading',
    props: [
      { key: 'text', label: 'Text', type: 'text', default: 'Section heading' },
      { key: 'level', label: 'Size', type: 'select', default: 'h2', options: ['h1','h2','h3'] },
      { key: 'align', label: 'Alignment', type: 'select', default: 'left', options: ['left','center','right'] },
    ],
    render(p) {
      const tag = p.level || 'h2';
      const sizes = { h1: '36px', h2: '28px', h3: '22px' };
      return `<section style="padding:40px 20px;max-width:800px;margin:0 auto;text-align:${esc(p.align||'left')}">
        <${tag} style="font-size:${sizes[p.level]||'28px'};font-weight:700;margin:0">${esc(p.text||'')}</${tag}>
      </section>`;
    },
  },
  {
    type: 'paragraph', category: 'Text', label: 'Paragraph', icon: 'fa-paragraph',
    props: [
      { key: 'text', label: 'Text', type: 'textarea', default: 'Write your text here. You can describe your product, share a story, or explain a feature.' },
      { key: 'align', label: 'Alignment', type: 'select', default: 'left', options: ['left','center','right'] },
    ],
    render(p) {
      return `<section style="padding:30px 20px;max-width:720px;margin:0 auto;text-align:${esc(p.align||'left')}">
        <p style="font-size:17px;line-height:1.7;color:#444;margin:0;white-space:pre-wrap">${esc(p.text||'')}</p>
      </section>`;
    },
  },
  {
    type: 'feature-grid', category: 'Text', label: 'Feature grid', icon: 'fa-th-large',
    props: [
      { key: 'title', label: 'Section title', type: 'text', default: 'Why choose us' },
      { key: 'columns', label: 'Columns', type: 'select', default: '3', options: ['2','3','4'] },
      { key: 'items', label: 'Features', type: 'list', default: [
        { icon: '⚡', title: 'Fast', text: 'Lightning quick performance' },
        { icon: '🔒', title: 'Secure', text: 'Bank-grade encryption' },
        { icon: '📱', title: 'Responsive', text: 'Works on all devices' },
      ]},
    ],
    render(p) {
      const cols = p.columns || '3';
      const items = (p.items || []).map(item => `
        <div style="text-align:center;padding:20px">
          <div style="font-size:36px;margin-bottom:12px">${esc(item.icon||'')}</div>
          <h3 style="font-size:18px;font-weight:700;margin:0 0 8px">${esc(item.title||'')}</h3>
          <p style="font-size:14px;color:#666;margin:0;line-height:1.5">${esc(item.text||'')}</p>
        </div>`).join('');
      return `<section style="padding:60px 20px;max-width:1000px;margin:0 auto">
        <h2 style="text-align:center;font-size:32px;font-weight:700;margin:0 0 40px">${esc(p.title||'')}</h2>
        <div style="display:grid;grid-template-columns:repeat(${esc(cols)},1fr);gap:20px">${items}
        </div>
      </section>`;
    },
  },

  // ── Media ──
  {
    type: 'image', category: 'Media', label: 'Image', icon: 'fa-image',
    props: [
      { key: 'src', label: 'Image URL', type: 'text', default: 'https://placehold.co/800x400' },
      { key: 'alt', label: 'Alt text', type: 'text', default: '' },
      { key: 'caption', label: 'Caption', type: 'text', default: '' },
    ],
    render(p) {
      const cap = p.caption ? `<p style="text-align:center;font-size:13px;color:#888;margin:8px 0 0">${esc(p.caption)}</p>` : '';
      return `<section style="padding:30px 20px;max-width:800px;margin:0 auto">
        <img src="${esc(p.src||'')}" alt="${esc(p.alt||'')}" style="width:100%;border-radius:12px;display:block">
        ${cap}
      </section>`;
    },
  },

  // ── CTA ──
  {
    type: 'button-row', category: 'CTA', label: 'Button row', icon: 'fa-hand-pointer',
    props: [
      { key: 'align', label: 'Alignment', type: 'select', default: 'center', options: ['left','center','right'] },
      { key: 'buttons', label: 'Buttons', type: 'list', default: [
        { label: 'Get started', link: '#', style: 'primary' },
        { label: 'Learn more', link: '#', style: 'secondary' },
      ]},
    ],
    render(p) {
      const styles = { primary: 'background:#3b82f6;color:#fff', secondary: 'background:transparent;color:#3b82f6;border:2px solid #3b82f6' };
      const btns = (p.buttons || []).map(b =>
        `<a href="${esc(b.link||'#')}" style="display:inline-block;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;margin:0 6px;${styles[b.style]||styles.primary}">${esc(b.label||'')}</a>`
      ).join('');
      return `<section style="padding:30px 20px;text-align:${esc(p.align||'center')}">${btns}</section>`;
    },
  },

  // ── Social proof ──
  {
    type: 'testimonials', category: 'Social', label: 'Testimonials', icon: 'fa-quote-right',
    props: [
      { key: 'title', label: 'Section title', type: 'text', default: 'What people say' },
      { key: 'items', label: 'Testimonials', type: 'list', default: [
        { quote: 'This product changed how we work.', name: 'Jane Doe', role: 'CEO, Acme' },
        { quote: 'Best decision we made all year.', name: 'John Smith', role: 'CTO, TechCo' },
        { quote: 'Simple, fast, and reliable.', name: 'Sarah Lee', role: 'Founder, Startup' },
      ]},
    ],
    render(p) {
      const items = (p.items || []).map(t => `
        <div style="background:#f8f9fa;border-radius:12px;padding:24px">
          <p style="font-size:16px;line-height:1.6;color:#333;margin:0 0 16px;font-style:italic">"${esc(t.quote||'')}"</p>
          <div style="font-weight:600;font-size:14px">${esc(t.name||'')}</div>
          <div style="font-size:13px;color:#888">${esc(t.role||'')}</div>
        </div>`).join('');
      return `<section style="padding:60px 20px;max-width:1000px;margin:0 auto">
        <h2 style="text-align:center;font-size:32px;font-weight:700;margin:0 0 40px">${esc(p.title||'')}</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px">${items}
        </div>
      </section>`;
    },
  },

  // ── Layout ──
  {
    type: 'divider', category: 'Layout', label: 'Divider', icon: 'fa-minus',
    props: [
      { key: 'style', label: 'Style', type: 'select', default: 'line', options: ['line','space'] },
    ],
    render(p) {
      if (p.style === 'space') return '<div style="height:40px"></div>';
      return '<hr style="border:none;border-top:1px solid #e5e7eb;margin:0;max-width:800px;margin:0 auto">';
    },
  },

  // ── Footer ──
  {
    type: 'footer-simple', category: 'Footer', label: 'Footer', icon: 'fa-shoe-prints',
    props: [
      { key: 'text', label: 'Copyright text', type: 'text', default: '© 2026 Your Company' },
      { key: 'links', label: 'Links', type: 'list', default: [
        { label: 'Privacy', url: '/privacy' },
        { label: 'Terms', url: '/terms' },
        { label: 'Contact', url: '/contact' },
      ]},
    ],
    render(p) {
      const links = (p.links || []).map(l =>
        `<a href="${esc(l.url||'#')}" style="color:#999;text-decoration:none;margin:0 12px;font-size:14px">${esc(l.label||'')}</a>`
      ).join('');
      return `<footer style="background:#111;color:#999;text-align:center;padding:30px 20px">
        <div style="margin-bottom:12px">${links}</div>
        <p style="font-size:13px;margin:0">${esc(p.text||'')}</p>
      </footer>`;
    },
  },

  // ── Raw HTML (preserves inferred/legacy markup) ──
  {
    type: 'raw-html', category: 'Advanced', label: 'Raw HTML', icon: 'fa-code',
    props: [
      { key: 'html', label: 'HTML', type: 'textarea', default: '<section style="padding:40px 20px"><p>Custom HTML</p></section>' },
    ],
    render(p) {
      return p.html || '';
    },
  },

  // ── Pricing ──
  {
    type: 'pricing', category: 'CTA', label: 'Pricing table', icon: 'fa-tags',
    props: [
      { key: 'title', label: 'Section title', type: 'text', default: 'Pricing' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Choose the plan that works for you.' },
      { key: 'plans', label: 'Plans', type: 'list', default: [
        { name: 'Starter', price: '$9', period: '/mo', features: '1 user\nBasic support\n10 projects', cta: 'Get started', highlighted: '' },
        { name: 'Pro', price: '$29', period: '/mo', features: '5 users\nPriority support\nUnlimited projects', cta: 'Get started', highlighted: 'true' },
        { name: 'Enterprise', price: 'Custom', period: '', features: 'Unlimited users\nDedicated support\nCustom integrations', cta: 'Contact sales', highlighted: '' },
      ]},
    ],
    render(p) {
      const title = p.title ? `<h2 style="text-align:center;font-size:32px;font-weight:700;margin:0 0 8px">${esc(p.title)}</h2>` : '';
      const subtitle = p.subtitle ? `<p style="text-align:center;font-size:18px;color:#666;margin:0 0 40px">${esc(p.subtitle)}</p>` : '';
      const plans = (p.plans || []).map(plan => {
        const highlighted = plan.highlighted === 'true' || plan.highlighted === true;
        const border = highlighted ? 'border:2px solid #3b82f6;transform:scale(1.02)' : 'border:1px solid #e5e7eb';
        const features = String(plan.features || '').split('\n').map(f => `<li style="padding:6px 0;border-bottom:1px solid #f3f4f6">${esc(f)}</li>`).join('');
        return `<div style="${border};border-radius:12px;padding:28px;background:#fff;${highlighted?'box-shadow:0 8px 24px rgba(0,0,0,0.08)':''}">
          <h3 style="font-size:20px;font-weight:700;margin:0 0 8px">${esc(plan.name||'')}</h3>
          <div style="font-size:36px;font-weight:800;margin:0 0 16px">${esc(plan.price||'')}${esc(plan.period||'')}</div>
          <ul style="list-style:none;padding:0;margin:0 0 20px;font-size:14px;color:#555">${features}</ul>
          <a href="#" style="display:block;text-align:center;padding:12px 0;background:${highlighted?'#3b82f6':'#111'};color:#fff;border-radius:8px;text-decoration:none;font-weight:600">${esc(plan.cta||'Get started')}</a>
        </div>`;
      }).join('');
      return `<section style="padding:60px 20px;max-width:1000px;margin:0 auto">
        ${title}${subtitle}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;align-items:start">${plans}</div>
      </section>`;
    },
  },

  // ── Contact / Newsletter form ──
  {
    type: 'contact-form', category: 'CTA', label: 'Contact form', icon: 'fa-envelope',
    props: [
      { key: 'title', label: 'Title', type: 'text', default: 'Get in touch' },
      { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'We will get back to you within 24 hours.' },
      { key: 'fields', label: 'Fields', type: 'list', default: [
        { label: 'Name', type: 'text', required: 'true' },
        { label: 'Email', type: 'email', required: 'true' },
        { label: 'Message', type: 'textarea', required: 'true' },
      ]},
      { key: 'submitLabel', label: 'Submit button', type: 'text', default: 'Send message' },
      { key: 'successMessage', label: 'Success message', type: 'text', default: 'Thanks! We received your message.' },
    ],
    render(p) {
      const fields = (p.fields || []).map(f => {
        const required = f.required === 'true' || f.required === true ? ' required' : '';
        const labelHtml = `<label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">${esc(f.label||'')}${required?' *':''}</label>`;
        if (f.type === 'textarea') {
          return `<div style="margin-bottom:14px">${labelHtml}<textarea name="${esc(f.label||'field')}" rows="4" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px"${required}></textarea></div>`;
        }
        return `<div style="margin-bottom:14px">${labelHtml}<input type="${esc(f.type||'text')}" name="${esc(f.label||'field')}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px"${required}></div>`;
      }).join('');
      const title = p.title ? `<h2 style="font-size:28px;font-weight:700;margin:0 0 8px">${esc(p.title)}</h2>` : '';
      const subtitle = p.subtitle ? `<p style="color:#666;margin:0 0 24px">${esc(p.subtitle)}</p>` : '';
      return `<section style="padding:60px 20px;max-width:600px;margin:0 auto">
        ${title}${subtitle}
        <form style="background:#f9fafb;border-radius:12px;padding:28px" onsubmit="event.preventDefault();this.innerHTML='<p style=\\'text-align:center\\'>${esc(p.successMessage||'Sent!')}</p>';">
          ${fields}
          <button type="submit" style="width:100%;padding:12px;background:#111;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer">${esc(p.submitLabel||'Send')}</button>
        </form>
      </section>`;
    },
  },

  // ── FAQ accordion ──
  {
    type: 'faq', category: 'Text', label: 'FAQ', icon: 'fa-circle-question',
    props: [
      { key: 'title', label: 'Section title', type: 'text', default: 'Frequently asked questions' },
      { key: 'items', label: 'Questions', type: 'list', default: [
        { question: 'How does it work?', answer: 'You sign up, connect your account, and start building.' },
        { question: 'Can I cancel anytime?', answer: 'Yes, you can cancel or change plans at any time.' },
        { question: 'Do you offer support?', answer: 'Yes — email support for all plans, live chat on Pro and Enterprise.' },
      ]},
    ],
    render(p) {
      const title = p.title ? `<h2 style="text-align:center;font-size:32px;font-weight:700;margin:0 0 40px">${esc(p.title)}</h2>` : '';
      const items = (p.items || []).map((item, idx) => `<details style="border-bottom:1px solid #e5e7eb;padding:16px 0" ${idx===0?'open':''}>
        <summary style="font-size:17px;font-weight:600;cursor:pointer;list-style:none">${esc(item.question||'')}</summary>
        <p style="font-size:15px;color:#666;line-height:1.6;margin:10px 0 0">${esc(item.answer||'')}</p>
      </details>`).join('');
      return `<section style="padding:60px 20px;max-width:720px;margin:0 auto">
        ${title}
        <div>${items}</div>
      </section>`;
    },
  },
];

// Helper: escape HTML to prevent injection from user content
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Helper: get block definition by type
window.SL_BLOCK_GET = (type) => window.SL_BLOCKS.find(b => b.type === type);

// Helper: create default props for a block type
window.SL_BLOCK_DEFAULTS = (type) => {
  const def = window.SL_BLOCK_GET(type);
  if (!def) return {};
  const props = {};
  for (const f of def.props) props[f.key] = JSON.parse(JSON.stringify(f.default));
  return props;
};
