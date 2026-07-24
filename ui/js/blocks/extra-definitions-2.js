/* Extra block definitions — second batch (15 blocks)
   Loaded after definitions.js and extra-definitions-1.js; appends to window.SL_BLOCKS */

(function () {
  const extra = [
    // ── Commerce / Pricing ──
    {
      type: 'comparison-table', category: 'CTA', label: 'Comparison table', icon: 'fa-table',
      props: [
        { key: 'title', label: 'Title', type: 'text', default: 'Compare plans' },
        { key: 'plans', label: 'Plans', type: 'list', default: [{ name: 'Starter' }, { name: 'Pro' }, { name: 'Enterprise' }] },
        { key: 'features', label: 'Features', type: 'list', default: [{ name: 'Feature A', starter: '✓', pro: '✓', enterprise: '✓' }, { name: 'Feature B', starter: '—', pro: '✓', enterprise: '✓' }] },
      ],
      render(p) {
        const plans = (p.plans || []).map(pl => `<th style="padding:12px;border-bottom:2px solid #ddd;font-weight:700;text-align:center">${esc(pl.name||'')}</th>`).join('');
        const keys = (p.plans || []).map((pl, idx) => Object.keys(pl).find(k => k !== 'name') || String(idx));
        const rows = (p.features || []).map(f => {
          const cells = (p.plans || []).map((pl, idx) => {
            const key = keys[idx];
            const val = f[key] || f[pl.name?.toLowerCase()] || '—';
            return `<td style="padding:12px;border-bottom:1px solid #eee;text-align:center">${esc(val)}</td>`;
          }).join('');
          return `<tr><td style="padding:12px;border-bottom:1px solid #eee;font-weight:600">${esc(f.name||'')}</td>${cells}</tr>`;
        }).join('');
        return `<section style="padding:60px 20px;max-width:900px;margin:0 auto;overflow-x:auto">
          <h2 style="font-size:28px;font-weight:700;margin:0 0 24px;text-align:center;color:#111">${esc(p.title||'')}</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th style="padding:12px;border-bottom:2px solid #ddd;text-align:left">Feature</th>${plans}</tr></thead><tbody>${rows}</tbody></table>
        </section>`;
      },
    },
    {
      type: 'countdown', category: 'CTA', label: 'Countdown timer', icon: 'fa-hourglass-half',
      props: [
        { key: 'date', label: 'Target date', type: 'text', default: '2026-12-31T00:00:00' },
        { key: 'title', label: 'Title', type: 'text', default: 'Offer ends in' },
        { key: 'bgColor', label: 'Background color', type: 'color', default: '#111827' },
        { key: 'textColor', label: 'Text color', type: 'color', default: '#ffffff' },
      ],
      render(p) {
        return `<section style="padding:50px 20px;background:${esc(p.bgColor||'#111827')};color:${esc(p.textColor||'#fff')};text-align:center">
          <h2 style="font-size:24px;font-weight:700;margin:0 0 20px">${esc(p.title||'')}</h2>
          <div style="font-size:42px;font-weight:800;font-variant-numeric:tabular-nums" data-countdown="${esc(p.date||'')}">00:00:00:00</div>
        </section>`;
      },
    },

    // ── Media / Layout ──
    {
      type: 'map-embed', category: 'Media', label: 'Map embed', icon: 'fa-map-location-dot',
      props: [
        { key: 'src', label: 'Embed URL', type: 'text', default: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.0!2d-74.006!3d40.7128!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zM40zMCcwNi4xIk4gNzTCsDAwJzIxLjYiVw!5e0!3m2!1sen!2sus!4v1609459200000!5m2!1sen!2sus' },
        { key: 'height', label: 'Height (px)', type: 'text', default: '400' },
      ],
      render(p) {
        return `<section style="padding:0;max-width:100%;margin:0 auto">
          <iframe src="${esc(p.src||'')}" style="width:100%;height:${parseInt(p.height)||400}px;border:none" loading="lazy"></iframe>
        </section>`;
      },
    },
    {
      type: 'gallery-carousel', category: 'Media', label: 'Image carousel', icon: 'fa-circle-play',
      props: [
        { key: 'images', label: 'Images', type: 'list', default: [{ src: '', alt: 'Slide 1' }, { src: '', alt: 'Slide 2' }, { src: '', alt: 'Slide 3' }] },
        { key: 'height', label: 'Height (px)', type: 'text', default: '400' },
      ],
      render(p) {
        const slides = (p.images || []).map((img, idx) => `<img src="${esc(img.src||'')}" alt="${esc(img.alt||'')}" style="width:100%;height:${parseInt(p.height)||400}px;object-fit:cover;display:${idx===0?'block':'none'}">`).join('');
        return `<section style="padding:60px 20px;max-width:900px;margin:0 auto">
          <div style="position:relative;border-radius:12px;overflow:hidden;background:#f3f4f6">${slides}</div>
        </section>`;
      },
    },

    // ── Social / Team ──
    {
      type: 'team-grid', category: 'Social', label: 'Team grid', icon: 'fa-users',
      props: [
        { key: 'title', label: 'Title', type: 'text', default: 'Meet the team' },
        { key: 'members', label: 'Members', type: 'list', default: [{ name: 'Alex', role: 'Founder', photo: '' }, { name: 'Sam', role: 'Engineer', photo: '' }, { name: 'Jordan', role: 'Designer', photo: '' }] },
      ],
      render(p) {
        const members = (p.members || []).map(m => `<div style="text-align:center"><img src="${esc(m.photo||'')}" alt="${esc(m.name||'')}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;background:#ddd;margin-bottom:12px"><h3 style="font-size:18px;font-weight:700;margin:0;color:#111">${esc(m.name||'')}</h3><p style="font-size:14px;color:#666;margin:0">${esc(m.role||'')}</p></div>`).join('');
        return `<section style="padding:60px 20px;max-width:1000px;margin:0 auto;text-align:center">
          <h2 style="font-size:30px;font-weight:700;margin:0 0 40px;color:#111">${esc(p.title||'')}</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:30px">${members}</div>
        </section>`;
      },
    },
    {
      type: 'testimonial-cards', category: 'Social', label: 'Testimonial cards', icon: 'fa-comments',
      props: [
        { key: 'title', label: 'Title', type: 'text', default: 'What people say' },
        { key: 'items', label: 'Testimonials', type: 'list', default: [{ quote: 'Incredible tool.', name: 'A', role: 'CEO' }, { quote: 'Saved us hours.', name: 'B', role: 'CTO' }] },
      ],
      render(p) {
        const cards = (p.items || []).map(i => `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;text-align:left"><p style="font-size:16px;color:#444;line-height:1.6;margin:0 0 16px;font-style:italic">"${esc(i.quote||'')}"</p><div style="font-weight:700;color:#111">${esc(i.name||'')}</div><div style="font-size:13px;color:#666">${esc(i.role||'')}</div></div>`).join('');
        return `<section style="padding:60px 20px;background:#f9fafb">
          <h2 style="font-size:28px;font-weight:700;margin:0 0 30px;text-align:center;color:#111">${esc(p.title||'')}</h2>
          <div style="max-width:1000px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px">${cards}</div>
        </section>`;
      },
    },
    {
      type: 'social-links', category: 'Social', label: 'Social links', icon: 'fa-share-nodes',
      props: [
        { key: 'links', label: 'Links', type: 'list', default: [{ platform: 'Twitter', url: '#' }, { platform: 'LinkedIn', url: '#' }, { platform: 'GitHub', url: '#' }] },
      ],
      render(p) {
        const links = (p.links || []).map(l => `<a href="${esc(l.url||'#')}" style="display:inline-flex;align-items:center;gap:8px;padding:10px 18px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin:6px">${esc(l.platform||'')}</a>`).join('');
        return `<section style="padding:40px 20px;text-align:center"><div>${links}</div></section>`;
      },
    },
    {
      type: 'trust-badges', category: 'Social', label: 'Trust badges', icon: 'fa-shield-halved',
      props: [
        { key: 'badges', label: 'Badges', type: 'list', default: [{ text: 'SSL Secure' }, { text: 'GDPR Compliant' }, { text: 'SOC 2' }] },
      ],
      render(p) {
        const badges = (p.badges || []).map(b => `<div style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:#f3f4f6;border-radius:20px;font-size:13px;font-weight:600;color:#444"><span style="color:#22c55e">✓</span>${esc(b.text||'')}</div>`).join('');
        return `<section style="padding:30px 20px"><div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px">${badges}</div></section>`;
      },
    },

    // ── Content / Layout ──
    {
      type: 'tabs', category: 'Layout', label: 'Tabs', icon: 'fa-folder',
      props: [
        { key: 'items', label: 'Tabs', type: 'list', default: [{ title: 'Tab 1', content: 'First tab content.' }, { title: 'Tab 2', content: 'Second tab content.' }, { title: 'Tab 3', content: 'Third tab content.' }] },
      ],
      render(p) {
        const tabs = (p.items || []).map((t, idx) => `<button style="padding:10px 18px;background:${idx===0?'#fff;border-bottom:2px solid #3b82f6':'transparent;border:none'};color:#111;cursor:pointer;font-weight:600">${esc(t.title||'')}</button>`).join('');
        const panels = (p.items || []).map((t, idx) => `<div style="padding:20px;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 8px 8px;display:${idx===0?'block':'none'}">${esc(t.content||'').replace(/\n/g, '<br>')}</div>`).join('');
        return `<section style="padding:60px 20px;max-width:800px;margin:0 auto">
          <div style="display:flex;border-bottom:1px solid #e5e7eb">${tabs}</div>
          ${panels}
        </section>`;
      },
    },
    {
      type: 'timeline', category: 'Layout', label: 'Timeline', icon: 'fa-clock-rotate-left',
      props: [
        { key: 'title', label: 'Title', type: 'text', default: 'Our journey' },
        { key: 'events', label: 'Events', type: 'list', default: [{ date: '2024', title: 'Started', description: 'We launched the first version.' }, { date: '2025', title: 'Grew', description: 'Reached 1,000 customers.' }] },
      ],
      render(p) {
        const events = (p.events || []).map(e => `<div style="display:flex;gap:20px;margin-bottom:24px"><div style="width:80px;flex-shrink:0;font-weight:700;color:#3b82f6;text-align:right">${esc(e.date||'')}</div><div><div style="font-weight:700;color:#111">${esc(e.title||'')}</div><div style="color:#666;font-size:14px">${esc(e.description||'')}</div></div></div>`).join('');
        return `<section style="padding:60px 20px;max-width:700px;margin:0 auto">
          <h2 style="font-size:28px;font-weight:700;margin:0 0 30px;color:#111">${esc(p.title||'')}</h2>
          <div style="border-left:3px solid #e5e7eb;padding-left:24px">${events}</div>
        </section>`;
      },
    },
    {
      type: 'pricing-toggle', category: 'Commerce', label: 'Pricing toggle', icon: 'fa-toggle-on',
      props: [
        { key: 'title', label: 'Title', type: 'text', default: 'Flexible pricing' },
        { key: 'monthly', label: 'Monthly plans', type: 'list', default: [{ name: 'Basic', price: '$9', features: 'A\nB' }, { name: 'Pro', price: '$29', features: 'A\nB\nC' }] },
        { key: 'yearly', label: 'Yearly plans', type: 'list', default: [{ name: 'Basic', price: '$90', features: 'A\nB' }, { name: 'Pro', price: '$290', features: 'A\nB\nC' }] },
      ],
      render(p) {
        const renderPlan = (plan) => {
          const feats = String(plan.features || '').split('\n').filter(Boolean).map(f => `<li style="padding:4px 0">${esc(f)}</li>`).join('');
          return `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:24px;background:#fff"><h3 style="font-size:18px;font-weight:700;margin:0 0 8px">${esc(plan.name||'')}</h3><div style="font-size:32px;font-weight:800;margin:0 0 12px">${esc(plan.price||'')}</div><ul style="list-style:none;padding:0;font-size:14px;color:#555">${feats}</ul></div>`;
        };
        const monthly = (p.monthly || []).map(renderPlan).join('');
        const yearly = (p.yearly || []).map(renderPlan).join('');
        return `<section style="padding:60px 20px;max-width:900px;margin:0 auto">
          <h2 style="font-size:28px;font-weight:700;text-align:center;margin:0 0 20px;color:#111">${esc(p.title||'')}</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;margin-bottom:20px">${monthly}</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;display:none">${yearly}</div>
        </section>`;
      },
    },

    // ── Navigation ──
    {
      type: 'navbar', category: 'Navigation', label: 'Navbar', icon: 'fa-bars',
      props: [
        { key: 'brand', label: 'Brand', type: 'text', default: 'Your brand' },
        { key: 'links', label: 'Links', type: 'list', default: [{ label: 'Features', url: '#features' }, { label: 'Pricing', url: '#pricing' }, { label: 'Contact', url: '#contact' }] },
        { key: 'ctaLabel', label: 'CTA label', type: 'text', default: 'Get started' },
        { key: 'ctaLink', label: 'CTA link', type: 'text', default: '#' },
      ],
      render(p) {
        const links = (p.links || []).map(l => `<a href="${esc(l.url||'#')}" style="color:#333;text-decoration:none;font-size:14px;font-weight:500">${esc(l.label||'')}</a>`).join('');
        const cta = p.ctaLabel ? `<a href="${esc(p.ctaLink||'#')}" style="padding:8px 16px;background:#111;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">${esc(p.ctaLabel)}</a>` : '';
        return `<nav style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;max-width:1200px;margin:0 auto">
          <div style="font-size:18px;font-weight:800;color:#111">${esc(p.brand||'')}</div>
          <div style="display:flex;align-items:center;gap:20px">${links}${cta}</div>
        </nav>`;
      },
    },

    // ── Utility ──
    {
      type: 'cookie-banner', category: 'Advanced', label: 'Cookie banner', icon: 'fa-cookie-bite',
      props: [
        { key: 'text', label: 'Text', type: 'textarea', default: 'We use cookies to improve your experience.' },
        { key: 'buttonLabel', label: 'Accept label', type: 'text', default: 'Accept' },
        { key: 'linkLabel', label: 'Learn more label', type: 'text', default: 'Learn more' },
        { key: 'linkUrl', label: 'Learn more URL', type: 'text', default: '/privacy' },
      ],
      render(p) {
        return `<div style="position:fixed;bottom:0;left:0;right:0;background:#111;color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;z-index:1000">
          <p style="margin:0;font-size:14px">${esc(p.text||'')}</p>
          <div style="display:flex;gap:10px">
            <a href="${esc(p.linkUrl||'/privacy')}" style="color:#fff;font-size:14px;text-decoration:underline">${esc(p.linkLabel||'Learn more')}</a>
            <button style="padding:8px 16px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600" onclick="this.parentElement.parentElement.style.display='none'">${esc(p.buttonLabel||'Accept')}</button>
          </div>
        </div>`;
      },
    },
    {
      type: 'marquee', category: 'Advanced', label: 'Marquee text', icon: 'fa-arrow-right-arrow-left',
      props: [
        { key: 'text', label: 'Text', type: 'text', default: 'New launch — get 20% off — limited time' },
        { key: 'bgColor', label: 'Background color', type: 'color', default: '#3b82f6' },
        { key: 'textColor', label: 'Text color', type: 'color', default: '#ffffff' },
      ],
      render(p) {
        return `<div style="background:${esc(p.bgColor||'#3b82f6')};color:${esc(p.textColor||'#fff')};padding:12px 0;overflow:hidden;white-space:nowrap">
          <div style="display:inline-block;padding-left:100%;animation:marquee 15s linear infinite;font-size:14px;font-weight:600">${esc(p.text||'')}</div>
        </div>`;
      },
    },
    {
      type: 'feature-list', category: 'Text', label: 'Feature list', icon: 'fa-list-check',
      props: [
        { key: 'title', label: 'Title', type: 'text', default: 'Why choose us' },
        { key: 'items', label: 'Features', type: 'list', default: [{ title: 'Fast', description: 'Built for speed', icon: '⚡' }, { title: 'Secure', description: 'Enterprise-grade', icon: '🔒' }, { title: 'Global', description: 'CDN worldwide', icon: '🌍' }] },
      ],
      render(p) {
        const items = (p.items || []).map(i => `<div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:18px"><div style="font-size:24px;flex-shrink:0">${esc(i.icon||'')}</div><div><h3 style="font-size:17px;font-weight:700;margin:0 0 4px;color:#111">${esc(i.title||'')}</h3><p style="font-size:14px;color:#666;margin:0;line-height:1.5">${esc(i.description||'')}</p></div></div>`).join('');
        return `<section style="padding:60px 20px;max-width:700px;margin:0 auto">
          <h2 style="font-size:28px;font-weight:700;margin:0 0 30px;color:#111">${esc(p.title||'')}</h2>
          ${items}
        </section>`;
      },
    },
  ];

  window.SL_BLOCKS.push(...extra);
})();
