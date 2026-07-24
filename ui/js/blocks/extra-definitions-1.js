/* Extra block definitions — first batch (15 blocks)
   Loaded after definitions.js; appends to window.SL_BLOCKS */

(function () {
  const extra = [
    // ── Hero ──
    {
      type: 'hero-video', category: 'Hero', label: 'Hero — video background', icon: 'fa-film',
      props: [
        { key: 'title', label: 'Title', type: 'text', default: 'Make an impact' },
        { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'A fullscreen video headline.' },
        { key: 'videoUrl', label: 'Video URL (.mp4)', type: 'text', default: '' },
        { key: 'poster', label: 'Poster image URL', type: 'text', default: '' },
        { key: 'ctaLabel', label: 'Button label', type: 'text', default: 'Get started' },
        { key: 'ctaLink', label: 'Button link', type: 'text', default: '#contact' },
      ],
      render(p) {
        const cta = p.ctaLabel ? `<a href="${esc(p.ctaLink||'#')}" style="display:inline-block;margin-top:24px;padding:14px 32px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">${esc(p.ctaLabel)}</a>` : '';
        const video = p.videoUrl ? `<video autoplay muted loop playsinline src="${esc(p.videoUrl)}" poster="${esc(p.poster||'')}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0"></video><div style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:0"></div>` : '';
        return `<section style="position:relative;overflow:hidden;color:#fff;text-align:center;padding:120px 20px">
          ${video}
          <div style="position:relative;z-index:1;max-width:800px;margin:0 auto">
            <h1 style="font-size:48px;font-weight:800;line-height:1.1;margin:0 0 16px">${esc(p.title||'')}</h1>
            <p style="font-size:20px;opacity:0.9;margin:0 0 24px">${esc(p.subtitle||'')}</p>
            ${cta}
          </div>
        </section>`;
      },
    },
    {
      type: 'hero-minimal', category: 'Hero', label: 'Hero — minimal', icon: 'fa-minimize',
      props: [
        { key: 'title', label: 'Title', type: 'text', default: 'Simple and clear.' },
        { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'A light, minimal hero section.' },
        { key: 'align', label: 'Align', type: 'select', default: 'center', options: ['left','center','right'] },
      ],
      render(p) {
        return `<section style="padding:80px 20px;text-align:${esc(p.align||'center')}">
          <div style="max-width:720px;margin:0 auto">
            <h1 style="font-size:42px;font-weight:700;line-height:1.2;margin:0 0 12px;color:#111">${esc(p.title||'')}</h1>
            <p style="font-size:18px;color:#666;margin:0">${esc(p.subtitle||'')}</p>
          </div>
        </section>`;
      },
    },

    // ── Text ──
    {
      type: 'subheading', category: 'Text', label: 'Subheading', icon: 'fa-font',
      props: [
        { key: 'text', label: 'Text', type: 'text', default: 'A short, punchy subheading' },
        { key: 'align', label: 'Align', type: 'select', default: 'center', options: ['left','center','right'] },
      ],
      render(p) {
        return `<section style="padding:30px 20px;text-align:${esc(p.align||'center')}">
          <p style="font-size:20px;font-weight:600;color:#555;max-width:700px;margin:0 auto;line-height:1.4">${esc(p.text||'')}</p>
        </section>`;
      },
    },
    {
      type: 'rich-text', category: 'Text', label: 'Rich text', icon: 'fa-align-left',
      props: [
        { key: 'title', label: 'Title', type: 'text', default: 'Detailed explanation' },
        { key: 'text', label: 'Text', type: 'textarea', default: 'Write a longer paragraph here.\n\nAdd another paragraph if needed.' },
        { key: 'align', label: 'Align', type: 'select', default: 'left', options: ['left','center'] },
      ],
      render(p) {
        const paras = String(p.text||'').split('\n\n').filter(Boolean).map(t => `<p style="margin:0 0 14px;color:#444;line-height:1.7">${esc(t)}</p>`).join('');
        return `<section style="padding:60px 20px;max-width:720px;margin:0 auto;text-align:${esc(p.align||'left')}">
          <h2 style="font-size:28px;font-weight:700;margin:0 0 20px;color:#111">${esc(p.title||'')}</h2>
          ${paras}
        </section>`;
      },
    },
    {
      type: 'bullet-list', category: 'Text', label: 'Bullet list', icon: 'fa-list-ul',
      props: [
        { key: 'title', label: 'Title', type: 'text', default: 'What you get' },
        { key: 'items', label: 'Items', type: 'list', default: [{ text: 'First benefit' }, { text: 'Second benefit' }, { text: 'Third benefit' }] },
      ],
      render(p) {
        const items = (p.items || []).map(i => `<li style="margin-bottom:8px;padding-left:4px">${esc(i.text||'')}</li>`).join('');
        return `<section style="padding:60px 20px;max-width:700px;margin:0 auto">
          <h2 style="font-size:26px;font-weight:700;margin:0 0 20px;color:#111">${esc(p.title||'')}</h2>
          <ul style="font-size:16px;color:#444;line-height:1.7;padding-left:22px">${items}</ul>
        </section>`;
      },
    },
    {
      type: 'numbered-list', category: 'Text', label: 'Numbered list', icon: 'fa-list-ol',
      props: [
        { key: 'title', label: 'Title', type: 'text', default: 'How it works' },
        { key: 'items', label: 'Items', type: 'list', default: [{ text: 'Sign up in seconds' }, { text: 'Configure your project' }, { text: 'Launch and grow' }] },
      ],
      render(p) {
        const items = (p.items || []).map(i => `<li style="margin-bottom:10px;padding-left:4px">${esc(i.text||'')}</li>`).join('');
        return `<section style="padding:60px 20px;max-width:700px;margin:0 auto">
          <h2 style="font-size:26px;font-weight:700;margin:0 0 20px;color:#111">${esc(p.title||'')}</h2>
          <ol style="font-size:16px;color:#444;line-height:1.7;padding-left:24px">${items}</ol>
        </section>`;
      },
    },
    {
      type: 'checklist', category: 'Text', label: 'Checklist', icon: 'fa-check-square',
      props: [
        { key: 'title', label: 'Title', type: 'text', default: 'Everything included' },
        { key: 'items', label: 'Items', type: 'list', default: [{ text: 'Unlimited pages' }, { text: 'Custom domain' }, { text: 'Analytics dashboard' }] },
      ],
      render(p) {
        const items = (p.items || []).map(i => `<li style="margin-bottom:10px;list-style:none;position:relative;padding-left:26px"><span style="position:absolute;left:0;color:#22c55e;font-weight:700">✓</span>${esc(i.text||'')}</li>`).join('');
        return `<section style="padding:60px 20px;max-width:700px;margin:0 auto">
          <h2 style="font-size:26px;font-weight:700;margin:0 0 20px;color:#111">${esc(p.title||'')}</h2>
          <ul style="font-size:16px;color:#444;line-height:1.7;padding:0">${items}</ul>
        </section>`;
      },
    },
    {
      type: 'quote', category: 'Text', label: 'Quote / pull quote', icon: 'fa-quote-left',
      props: [
        { key: 'quote', label: 'Quote', type: 'textarea', default: 'This product changed how our team works.' },
        { key: 'author', label: 'Author', type: 'text', default: 'Jane Doe' },
        { key: 'role', label: 'Role', type: 'text', default: 'CEO, Acme' },
        { key: 'align', label: 'Align', type: 'select', default: 'center', options: ['left','center','right'] },
      ],
      render(p) {
        return `<section style="padding:60px 20px;text-align:${esc(p.align||'center')}">
          <blockquote style="max-width:700px;margin:0 auto;border-left:4px solid #3b82f6;padding-left:20px;font-size:22px;font-style:italic;color:#333;line-height:1.5">
            "${esc(p.quote||'').replace(/\n/g, '<br>')}"
          </blockquote>
          <div style="max-width:700px;margin:10px auto 0;font-size:14px;color:#666;font-weight:600">— ${esc(p.author||'')}, ${esc(p.role||'')}</div>
        </section>`;
      },
    },

    // ── Social / Proof ──
    {
      type: 'stats-row', category: 'Social', label: 'Stats row', icon: 'fa-chart-simple',
      props: [
        { key: 'stats', label: 'Stats', type: 'list', default: [{ label: 'Customers', value: '10k+' }, { label: 'Uptime', value: '99.9%' }, { label: 'Countries', value: '45+' }] },
      ],
      render(p) {
        const stats = (p.stats || []).map(s => `<div style="text-align:center;padding:20px"><div style="font-size:36px;font-weight:800;color:#111">${esc(s.value||'')}</div><div style="font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.5px">${esc(s.label||'')}</div></div>`).join('');
        return `<section style="padding:40px 20px;background:#f9fafb"><div style="max-width:900px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:20px">${stats}</div></section>`;
      },
    },
    {
      type: 'client-logos', category: 'Social', label: 'Client logos', icon: 'fa-building',
      props: [
        { key: 'title', label: 'Title', type: 'text', default: 'Trusted by teams at' },
        { key: 'logos', label: 'Logos', type: 'list', default: [{ name: 'Acme', src: '' }, { name: 'Globex', src: '' }, { name: 'Initech', src: '' }, { name: 'Soylent', src: '' }] },
      ],
      render(p) {
        const logos = (p.logos || []).map(l => `<div style="display:flex;align-items:center;justify-content:center;height:60px;padding:0 20px;background:#fff;border:1px solid #eee;border-radius:8px;font-weight:700;color:#888;min-width:120px">${esc(l.name||'')}</div>`).join('');
        return `<section style="padding:50px 20px;text-align:center">
          <p style="font-size:13px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 20px">${esc(p.title||'')}</p>
          <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:16px;max-width:1000px;margin:0 auto">${logos}</div>
        </section>`;
      },
    },

    // ── Media ──
    {
      type: 'image-grid', category: 'Media', label: 'Image grid', icon: 'fa-images',
      props: [
        { key: 'images', label: 'Images', type: 'list', default: [{ src: '', alt: 'Photo 1', caption: '' }, { src: '', alt: 'Photo 2', caption: '' }, { src: '', alt: 'Photo 3', caption: '' }] },
        { key: 'columns', label: 'Columns', type: 'select', default: '3', options: ['2','3','4'] },
      ],
      render(p) {
        const images = (p.images || []).map(img => `<figure style="margin:0"><img src="${esc(img.src||'')}" alt="${esc(img.alt||'')}" style="width:100%;height:200px;object-fit:cover;border-radius:8px"><figcaption style="font-size:12px;color:#666;margin-top:6px;text-align:center">${esc(img.caption||'')}</figcaption></figure>`).join('');
        return `<section style="padding:60px 20px;max-width:1000px;margin:0 auto">
          <div style="display:grid;grid-template-columns:repeat(${esc(p.columns||'3')},1fr);gap:16px">${images}</div>
        </section>`;
      },
    },
    {
      type: 'video-embed', category: 'Media', label: 'Video embed', icon: 'fa-youtube',
      props: [
        { key: 'url', label: 'Embed URL', type: 'text', default: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
        { key: 'title', label: 'Title', type: 'text', default: 'Watch the demo' },
        { key: 'aspect', label: 'Aspect ratio', type: 'select', default: '16:9', options: ['16:9','4:3','1:1'] },
      ],
      render(p) {
        const ratio = { '16:9': '56.25%', '4:3': '75%', '1:1': '100%' }[p.aspect] || '56.25%';
        return `<section style="padding:60px 20px;max-width:900px;margin:0 auto">
          <h2 style="font-size:26px;font-weight:700;margin:0 0 20px;text-align:center;color:#111">${esc(p.title||'')}</h2>
          <div style="position:relative;padding-bottom:${ratio};height:0;overflow:hidden;border-radius:12px;background:#000">
            <iframe src="${esc(p.url||'')}" title="${esc(p.title||'')}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allowfullscreen></iframe>
          </div>
        </section>`;
      },
    },

    // ── CTA ──
    {
      type: 'newsletter', category: 'CTA', label: 'Newsletter', icon: 'fa-paper-plane',
      props: [
        { key: 'title', label: 'Title', type: 'text', default: 'Join the newsletter' },
        { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Get the latest updates straight to your inbox.' },
        { key: 'buttonLabel', label: 'Button label', type: 'text', default: 'Subscribe' },
        { key: 'successMessage', label: 'Success message', type: 'text', default: 'Thanks for subscribing!' },
      ],
      render(p) {
        return `<section style="padding:60px 20px;background:#f3f4f6;text-align:center">
          <h2 style="font-size:28px;font-weight:700;margin:0 0 8px;color:#111">${esc(p.title||'')}</h2>
          <p style="font-size:16px;color:#666;margin:0 0 20px">${esc(p.subtitle||'')}</p>
          <form onsubmit="event.preventDefault();this.innerHTML='<p style=\\'color:#16a34a;font-weight:600\\'>${esc(p.successMessage||'Subscribed!')}</p>';" style="display:flex;gap:8px;justify-content:center;max-width:480px;margin:0 auto;flex-wrap:wrap">
            <input type="email" placeholder="you@example.com" required style="flex:1;min-width:200px;padding:12px 14px;border:1px solid #ccc;border-radius:8px;font-size:14px">
            <button type="submit" style="padding:12px 20px;background:#111;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer">${esc(p.buttonLabel||'Subscribe')}</button>
          </form>
        </section>`;
      },
    },
    {
      type: 'app-download', category: 'CTA', label: 'App download', icon: 'fa-mobile-screen',
      props: [
        { key: 'title', label: 'Title', type: 'text', default: 'Download the app' },
        { key: 'subtitle', label: 'Subtitle', type: 'text', default: 'Available on iOS and Android.' },
        { key: 'appStoreLink', label: 'App Store link', type: 'text', default: '#' },
        { key: 'playStoreLink', label: 'Play Store link', type: 'text', default: '#' },
      ],
      render(p) {
        const app = p.appStoreLink ? `<a href="${esc(p.appStoreLink)}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin:6px">App Store</a>` : '';
        const play = p.playStoreLink ? `<a href="${esc(p.playStoreLink)}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin:6px">Google Play</a>` : '';
        return `<section style="padding:60px 20px;text-align:center">
          <h2 style="font-size:28px;font-weight:700;margin:0 0 8px;color:#111">${esc(p.title||'')}</h2>
          <p style="font-size:16px;color:#666;margin:0 0 20px">${esc(p.subtitle||'')}</p>
          <div>${app}${play}</div>
        </section>`;
      },
    },
    {
      type: 'callout', category: 'CTA', label: 'Callout banner', icon: 'fa-bullhorn',
      props: [
        { key: 'title', label: 'Title', type: 'text', default: 'Special offer' },
        { key: 'text', label: 'Text', type: 'textarea', default: 'Get 20% off your first year. Limited time only.' },
        { key: 'bgColor', label: 'Background color', type: 'color', default: '#eff6ff' },
        { key: 'textColor', label: 'Text color', type: 'color', default: '#1e40af' },
        { key: 'align', label: 'Align', type: 'select', default: 'center', options: ['left','center'] },
      ],
      render(p) {
        return `<section style="padding:40px 20px;background:${esc(p.bgColor||'#eff6ff')};color:${esc(p.textColor||'#1e40af')};text-align:${esc(p.align||'center')};border-radius:12px;margin:20px auto;max-width:900px">
          <h3 style="font-size:22px;font-weight:700;margin:0 0 8px">${esc(p.title||'')}</h3>
          <p style="font-size:16px;margin:0;line-height:1.5">${esc(p.text||'').replace(/\n/g, '<br>')}</p>
        </section>`;
      },
    },
  ];

  window.SL_BLOCKS.push(...extra);
})();
