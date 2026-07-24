/* SuperLandings Admin v2 — Vue app root (non-technical-friendly UX) */
const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;

// ── Helpers ──
const fmtDate = (s) => { if (!s) return '—'; const d = new Date(s); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
const fmtRel = (s) => { if (!s) return '—'; const d = new Date(s); const diff = Date.now() - d.getTime(); const h = Math.floor(diff / 36e5); if (h < 1) return 'just now'; if (h < 24) return h + 'h ago'; const days = Math.floor(h / 24); if (days < 30) return days + 'd ago'; return fmtDate(s); };
function toast(msg, type = 'info') { window.dispatchEvent(new CustomEvent('toast', { detail: { msg, type } })); }
window.toast = toast;
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ── App ──
var app = createApp({
  setup() {
    const view = ref('loading'); // loading | login | dashboard | editor
    const me = ref(null);
    const landings = ref([]);
    const orgs = ref([]);
    const currentOrg = ref(null);
    const editing = ref(null);
    const loading = reactive({});
    const modal = ref(null);
    const whitelabelNav = ref(false);

    // ── Auth ──
    const checkAuth = async () => {
      try {
        const data = await API.me();
        if (!data.user) { view.value = 'login'; return; }
        me.value = data;
        orgs.value = data.organizations || [];
        // Prefer locally saved org choice, then server currentOrganization, then first org
        const savedOrgId = localStorage.getItem('sl_currentOrgId');
        const savedOrg = savedOrgId && orgs.value.find(o => o.id === savedOrgId);
        if (savedOrg) currentOrg.value = savedOrg;
        else if (data.currentOrganization) currentOrg.value = data.currentOrganization;
        else if (orgs.value.length) currentOrg.value = orgs.value[0];
        if (currentOrg.value) {
          API.setOrg(currentOrg.value.id);
          localStorage.setItem('sl_currentOrgId', currentOrg.value.id);
        }
        await loadLandings();
        view.value = 'dashboard';
      } catch { view.value = 'login'; }
    };

    const doLogin = async (u, p) => {
      try {
        loading.login = true;
        await API.login(u, p);
        await checkAuth();
      } catch (e) { toast(e.error || 'Login failed', 'error'); }
      finally { loading.login = false; }
    };

    const doLogout = async () => {
      try { await API.logout(); } catch {}
      window.location.href = '/login';
    };

    // ── Org switching ──
    const switchOrg = async (org) => {
      currentOrg.value = org;
      API.setOrg(org.id);
      localStorage.setItem('sl_currentOrgId', org.id);
      await loadLandings();
    };

    // ── Landings ──
    const loadLandings = async () => {
      try {
        loading.landings = true;
        landings.value = await API.landings.list();
      } catch (e) { toast('Could not load pages', 'error'); }
      finally { loading.landings = false; }
    };

    const openEditor = (l) => {
      editing.value = l;
      view.value = 'editor';
    };

    const closeEditor = () => {
      editing.value = null;
      view.value = 'dashboard';
      loadLandings();
    };

    // ── Landing actions ──
    const deleteLanding = async (l) => {
      if (!confirm(`Delete "${l.name}"? This cannot be undone.`)) return;
      try {
        await API.landings.delete(l.id);
        toast('Page deleted', 'success');
        await loadLandings();
      } catch (e) { toast(e.error || 'Delete failed', 'error'); }
    };

    const clearCache = async (l) => {
      try { await API.landings.clearCache(l.id); toast('Cache cleared', 'success'); }
      catch (e) { toast(e.error || 'Failed', 'error'); }
    };

    const saveLanding = async (id, content) => {
      try {
        await API.landings.update(id, { content });
        toast('Saved', 'success');
        return true;
      } catch (e) { toast(e.error || 'Save failed', 'error'); return false; }
    };

    // ── Create landing ──
    const createLanding = async (form) => {
      try {
        loading.create = true;
        await API.landings.create(form);
        toast('Page created', 'success');
        modal.value = null;
        await loadLandings();
      } catch (e) { toast(e.error || 'Create failed', 'error'); }
      finally { loading.create = false; }
    };

    // ── Reload after migration (refresh orgs + landings) ──
    const reloadAfterMigration = async () => {
      try {
        const data = await API.me();
        orgs.value = data.organizations || [];
        if (currentOrg.value && !orgs.value.find(o => o.id === currentOrg.value.id)) {
          currentOrg.value = orgs.value[0] || null;
          if (currentOrg.value) API.setOrg(currentOrg.value.id);
        }
      } catch {}
      await loadLandings();
    };

    // ── Modal control ──
    const openModal = (name, data = null) => { modal.value = { name, data }; };
    const closeModal = () => { modal.value = null; };

    const loadWhitelabel = async () => {
      try {
        const f = await API.config.fallbacks();
        whitelabelNav.value = f.WHITELABEL_NAV === 'true' || f.WHITELABEL_NAV === true || f.WHITELABEL_NAV === '1';
      } catch (err) {
        console.error('Failed to load whitelabel setting:', err);
      }
    };

    onMounted(async () => {
      await loadWhitelabel();
      await checkAuth();
    });

    return {
      view, me, landings, orgs, currentOrg, editing, loading, modal, whitelabelNav,
      doLogin, doLogout, switchOrg, loadLandings, openEditor, closeEditor,
      deleteLanding, clearCache, saveLanding, createLanding, reloadAfterMigration,
      openModal, closeModal, fmtDate, fmtRel, slugify, toast, loadWhitelabel,
    };
  },
  template: `
    <div v-if="view==='loading'" style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:var(--canvas)">
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
        <div style="width:20px;height:20px;border:2px solid var(--border-strong);border-top-color:var(--ink);border-radius:50%;animation:spin 700ms linear infinite"></div>
        <p class="text-muted" style="font-size:13px;letter-spacing:0.02em">Loading your workspace…</p>
      </div>
    </div>
    <login-view v-else-if="view==='login'" :do-login="doLogin" :loading="loading.login"></login-view>
    <div v-else>
      <app-shell :me="me" :orgs="orgs" :current-org="currentOrg" :view="view" :whitelabel="whitelabelNav"
        @switch-org="switchOrg" @logout="doLogout" @back="closeEditor">
        <dashboard-view v-if="view==='dashboard'"
          :landings="landings" :loading="loading.landings" :me="me" :orgs="orgs"
          @open="openEditor" @delete="deleteLanding" @clear-cache="clearCache"
          @create="openModal('create')" @versions="(l)=>openModal('versions',l)"
          @domains="(l)=>openModal('domains',l)" @audit="(l)=>openModal('audit',l)"
          @settings="openModal('settings')" @orgs="openModal('organizations')"
          @move="(l)=>openModal('move',l)"></dashboard-view>
        <editor-view v-else-if="view==='editor'" :landing="editing"
          @save="saveLanding" @close="closeEditor" @versions="(l)=>openModal('versions',l)"
          @domains="(l)=>openModal('domains',l)" @audit="(l)=>openModal('audit',l)"></editor-view>
      </app-shell>
      <modal-host v-if="modal" :modal="modal" :me="me" :orgs="orgs" :current-org="currentOrg"
        @close="closeModal" @created="loadLandings" @moved="loadLandings" @saved="loadLandings" @migrated="reloadAfterMigration" @toast="toast" @settings-saved="loadWhitelabel"></modal-host>
    </div>
    <toast-host></toast-host>
  `,
});

// ── Login View ──
app.component('login-view', {
  props: ['doLogin', 'loading'],
  setup(props) {
    const u = ref(''); const p = ref('');
    const submit = () => props.doLogin(u.value, p.value);
    return { u, p, submit };
  },
  template: `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:var(--canvas);padding:24px">
      <div style="max-width:380px;width:100%;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:48px;box-shadow:0 1px 3px rgba(0,0,0,0.03),0 12px 40px rgba(0,0,0,0.05)">
        <div style="text-align:center;margin-bottom:32px">
          <div style="width:44px;height:44px;background:var(--ink);color:var(--surface);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-family:var(--font-serif);font-size:20px;font-weight:600;margin-bottom:16px">S</div>
          <h1 class="font-serif" style="font-size:26px;letter-spacing:-0.02em;line-height:1.1;margin:0 0 6px">SuperLandings</h1>
          <p class="text-muted" style="font-size:13px;margin:0">Sign in to your studio</p>
        </div>
        <form @submit.prevent="submit">
          <label class="field" style="margin-bottom:16px"><span>Username or email</span>
            <input class="input" v-model="u" placeholder="admin" autofocus></label>
          <label class="field" style="margin-bottom:16px"><span>Password</span>
            <input class="input" type="password" v-model="p" placeholder="••••••"></label>
          <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:4px" :disabled="loading">
            {{ loading ? 'Signing in…' : 'Sign in' }}</button>
        </form>
      </div>
    </div>`
});

// ── App Shell (header) ──
app.component('app-shell', {
  props: ['me', 'orgs', 'currentOrg', 'view', 'whitelabel'],
  emits: ['switch-org', 'logout', 'back'],
  setup(props, { emit, slots }) {
    const showOrgMenu = ref(false);
    const navBrand = computed(() => {
      if (props.whitelabel && props.currentOrg?.name) return props.currentOrg.name;
      return 'SuperLandings';
    });
    return { showOrgMenu, emit, slots, navBrand };
  },
  template: `
    <header style="border-bottom:1px solid var(--border);background:var(--surface)">
      <div style="max-width:1200px;margin:0 auto;padding:0 24px;height:56px;display:flex;align-items:center;justify-content:between;gap:16px">
        <div style="display:flex;align-items:center;gap:12px;flex:1">
          <a v-if="view==='editor'" @click="emit('back')" class="btn btn-ghost" style="padding:6px 10px"><i class="fa-solid fa-arrow-left"></i> Pages</a>
          <span v-else class="font-serif" style="font-size:18px;font-weight:600;letter-spacing:-0.02em">{{navBrand}}</span>
        </div>
        <div v-if="me" style="display:flex;align-items:center;gap:12px">
          <div v-if="orgs.length>1" style="position:relative">
            <button class="btn btn-secondary" @click="showOrgMenu=!showOrgMenu">
              <i class="fa-solid fa-building" style="font-size:11px"></i> {{currentOrg?.name}} <i class="fa-solid fa-chevron-down" style="font-size:10px"></i></button>
            <div v-if="showOrgMenu" class="card-flat" style="position:absolute;right:0;top:100%;margin-top:4px;z-index:50;min-width:200px;max-height:300px;overflow-y:auto;padding:4px">
              <div v-for="o in orgs" :key="o.id" @click="emit('switch-org',o);showOrgMenu=false"
                style="padding:8px 12px;border-radius:4px;cursor:pointer" onmouseover="this.style.background='var(--surface-raised)'"
                onmouseout="this.style.background='transparent'">
                {{o.name}}</div>
            </div>
          </div>
          <span class="text-muted" style="font-size:12px">{{me.user?.email}}</span>
          <button class="btn btn-ghost" @click="emit('logout')" style="padding:6px 10px"><i class="fa-solid fa-arrow-right-from-bracket"></i></button>
        </div>
      </div>
    </header>
    <main style="max-width:1200px;margin:0 auto;padding:40px 24px;min-height:calc(100vh - 56px)"><slot></slot></main>`,
});

// ── Toast Host ──
app.component('toast-host', {
  setup() {
    const toasts = ref([]);
    const add = (e) => {
      const id = Date.now() + Math.random();
      toasts.value.push({ id, ...e.detail });
      setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id); }, 3000);
    };
    onMounted(() => window.addEventListener('toast', add));
    return { toasts };
  },
  template: `
    <div style="position:fixed;bottom:24px;right:24px;z-index:200;display:flex;flex-direction:column;gap:8px">
      <div v-for="t in toasts" :key="t.id" class="card" style="padding:12px 16px;display:flex;align-items:center;gap:10px;min-width:240px">
        <i :class="t.type==='error'?'fa-solid fa-circle-exclamation':t.type==='success'?'fa-solid fa-circle-check':'fa-solid fa-circle-info'"
           :style="t.type==='error'?'color:var(--pastel-red-fg)':t.type==='success'?'color:var(--pastel-green-fg)':'color:var(--pastel-blue-fg)'"></i>
        <span style="font-size:13px">{{t.msg}}</span>
      </div>
    </div>`,
});

window.app = app;
