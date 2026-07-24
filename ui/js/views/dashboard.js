/* Dashboard view — landing list as bento grid or condensed list */
app.component('dashboard-view', {
  props: ['landings', 'loading', 'me', 'orgs'],
  emits: ['open', 'delete', 'clear-cache', 'create', 'versions', 'domains', 'audit', 'settings', 'orgs', 'move'],
  setup(props, { emit }) {
    const search = ref('');
    const viewMode = ref(localStorage.getItem('sl_viewMode') || 'grid'); // grid | list
    const setViewMode = (m) => { viewMode.value = m; localStorage.setItem('sl_viewMode', m); };
    const filtered = computed(() => {
      if (!search.value) return props.landings;
      const q = search.value.toLowerCase();
      return props.landings.filter(l => l.name?.toLowerCase().includes(q) || l.slug?.toLowerCase().includes(q));
    });
    const typeLabel = (t) => ({ html: 'Web page', ejs: 'Multi-page', virtual: 'Virtual', 'traefik-config': 'Routing' }[t] || t);
    const isOnline = (l) => l.domains?.some(d => d.published);
    const canMove = computed(() => props.me?.isAdmin && (props.orgs?.length || 0) > 1);
    // Build the live URL: first published domain, else /:slug on current host
    const liveUrl = (l) => {
      const pub = l.domains?.find(d => d.published);
      if (pub) return `https://${pub.domain}`;
      return `${window.location.origin}/${l.slug}`;
    };
    const openLive = (l) => { window.open(liveUrl(l), '_blank', 'noopener'); };
    return { search, viewMode, setViewMode, filtered, emit, typeLabel, isOnline, canMove, liveUrl, openLive, fmtDate, fmtRel };
  },
  template: `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:12px">
        <div>
          <h1 class="font-serif" style="font-size:24px;letter-spacing:-0.02em;line-height:1.1;margin:0">Your pages</h1>
          <p class="text-muted" style="margin:2px 0 0;font-size:12px">{{landings.length}} {{landings.length===1?'page':'pages'}} in this workspace</p>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <div v-if="landings.length>0" style="display:flex;gap:2px;margin-right:4px" @click.stop>
            <button class="btn btn-ghost" @click="setViewMode('grid')" title="Grid view" :style="viewMode==='grid'?'background:var(--surface-raised)':''" style="padding:4px 8px"><i class="fa-solid fa-grip"></i></button>
            <button class="btn btn-ghost" @click="setViewMode('list')" title="List view" :style="viewMode==='list'?'background:var(--surface-raised)':''" style="padding:4px 8px"><i class="fa-solid fa-list"></i></button>
          </div>
          <button class="btn btn-secondary" @click="emit('orgs')" v-if="me?.isAdmin" style="font-size:12px;padding:6px 10px"><i class="fa-solid fa-users"></i> Team</button>
          <button class="btn btn-secondary" @click="emit('settings')" style="font-size:12px;padding:6px 10px"><i class="fa-solid fa-gear"></i> Settings</button>
          <button class="btn btn-primary" @click="emit('create')" style="font-size:12px;padding:6px 10px"><i class="fa-solid fa-plus"></i> New page</button>
        </div>
      </div>

      <div v-if="landings.length>5" style="margin-bottom:16px">
        <input class="input" v-model="search" placeholder="Search pages…" style="max-width:320px;font-size:13px">
      </div>

      <div v-if="loading" style="padding:60px 0;text-align:center"><p class="text-muted">Loading your pages…</p></div>

      <div v-else-if="filtered.length===0" style="padding:80px 0;text-align:center">
        <i class="fa-regular fa-file" style="font-size:32px;color:var(--ink-faint);margin-bottom:16px"></i>
        <h3 class="font-serif" style="font-size:22px;margin-bottom:8px">{{search?'No pages match':'No pages yet'}}</h3>
        <p class="text-muted" style="margin-bottom:24px">{{search?'Try a different search':'Create your first landing page to get started.'}}</p>
        <button v-if="!search" class="btn btn-primary" @click="emit('create')"><i class="fa-solid fa-plus"></i> Create your first page</button>
      </div>

      <!-- Grid view -->
      <div v-else-if="viewMode==='grid'" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
        <div v-for="(l,i) in filtered" :key="l.id" class="card"
          style="cursor:pointer;display:flex;flex-direction:column;overflow:hidden" @click="emit('open',l)">
          <!-- Thumbnail -->
          <div style="height:160px;overflow:hidden;border-bottom:1px solid var(--border);background:var(--surface-raised);position:relative">
            <div v-if="l.type==='html'||l.type==='ejs'||l.type==='virtual'"
              style="width:1000px;height:600px;transform:scale(0.28);transform-origin:top left;pointer-events:none">
              <iframe :src="liveUrl(l)" style="width:100%;height:100%;border:none" sandbox="allow-same-origin" loading="lazy" scrolling="no"></iframe>
            </div>
            <div v-else style="display:flex;align-items:center;justify-content:center;height:100%">
              <i class="fa-solid fa-route" style="font-size:32px;color:var(--ink-faint)"></i>
            </div>
          </div>
          <div style="padding:12px 14px;display:flex;flex-direction:column;gap:8px;flex:1">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <span class="tag" :class="isOnline(l)?'tag-green':'tag-gray'">
                <i :class="isOnline(l)?'fa-solid fa-circle':'fa-regular fa-circle'" style="font-size:6px;margin-right:6px"></i>
                {{isOnline(l)?'Online':'Draft'}}</span>
              <span class="text-faint" style="font-size:11px" @click.stop>{{typeLabel(l.type)}}</span>
            </div>
            <div>
              <h3 style="font-size:15px;font-weight:600;margin:0;line-height:1.3">{{l.name}}</h3>
              <p class="font-mono text-muted" style="font-size:11px;margin:2px 0 0">/{{l.slug}}</p>
            </div>
            <p v-if="l.domains?.length" class="text-muted" style="font-size:11px;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              <i class="fa-solid fa-link" style="font-size:9px"></i> {{l.domains.map(d=>d.domain).join(', ')}}
            </p>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:8px;border-top:1px solid var(--border)">
              <span class="text-faint" style="font-size:11px">Updated {{fmtRel(l.updatedAt||l.createdAt)}}</span>
              <div @click.stop style="display:flex;gap:2px">
                <button class="btn btn-ghost" @click="openLive(l)" title="Open live page" style="padding:4px 8px"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
                <button class="btn btn-ghost" @click="emit('versions',l)" title="Versions" style="padding:4px 8px"><i class="fa-solid fa-clock-rotate-left"></i></button>
                <button class="btn btn-ghost" @click="emit('domains',l)" title="Domains" style="padding:4px 8px"><i class="fa-solid fa-globe"></i></button>
                <button class="btn btn-ghost" @click="emit('audit',l)" title="History" style="padding:4px 8px"><i class="fa-solid fa-list"></i></button>
                <button v-if="canMove" class="btn btn-ghost" @click="emit('move',l)" title="Move to workspace" style="padding:4px 8px"><i class="fa-solid fa-arrows-up-down-left-right"></i></button>
                <button class="btn btn-ghost" @click="emit('delete',l)" title="Delete" style="padding:4px 8px;color:var(--pastel-red-fg)"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- List view (condensed) -->
      <div v-else style="display:flex;flex-direction:column;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <div v-for="(l,i) in filtered" :key="l.id"
          style="display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:pointer;border-bottom:1px solid var(--border)"
          :style="i===filtered.length-1?'border-bottom:none':''"
          @click="emit('open',l)">
          <span class="tag" :class="isOnline(l)?'tag-green':'tag-gray'" style="flex-shrink:0;font-size:9px">
            <i :class="isOnline(l)?'fa-solid fa-circle':'fa-regular fa-circle'" style="font-size:5px;margin-right:4px"></i>
            {{isOnline(l)?'Online':'Draft'}}</span>
          <div style="flex:1;min-width:0">
            <span style="font-size:14px;font-weight:600">{{l.name}}</span>
            <span class="font-mono text-muted" style="font-size:12px;margin-left:8px">/{{l.slug}}</span>
          </div>
          <span v-if="l.domains?.length" class="text-muted" style="font-size:12px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0">{{l.domains.map(d=>d.domain).join(', ')}}</span>
          <span class="text-faint" style="font-size:11px;flex-shrink:0;width:90px;text-align:right">{{fmtRel(l.updatedAt||l.createdAt)}}</span>
          <div @click.stop style="display:flex;gap:2px;flex-shrink:0">
            <button class="btn btn-ghost" @click="openLive(l)" title="Open live" style="padding:4px 8px"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
            <button class="btn btn-ghost" @click="emit('versions',l)" title="Versions" style="padding:4px 8px"><i class="fa-solid fa-clock-rotate-left"></i></button>
            <button class="btn btn-ghost" @click="emit('domains',l)" title="Domains" style="padding:4px 8px"><i class="fa-solid fa-globe"></i></button>
            <button class="btn btn-ghost" @click="emit('audit',l)" title="History" style="padding:4px 8px"><i class="fa-solid fa-list"></i></button>
            <button v-if="canMove" class="btn btn-ghost" @click="emit('move',l)" title="Move" style="padding:4px 8px"><i class="fa-solid fa-arrows-up-down-left-right"></i></button>
            <button class="btn btn-ghost" @click="emit('delete',l)" title="Delete" style="padding:4px 8px;color:var(--pastel-red-fg)"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    </div>`,
});
