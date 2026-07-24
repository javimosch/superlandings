/* Settings modal — Traefik, LLM, persistence, migration tools */
app.component('settings-modal', {
  props: ['me', 'orgs'],
  emits: ['close', 'toast', 'migrated', 'settings-saved'],
  setup(props, { emit }) {
    const tab = ref('general');
    const config = ref(null);
    const fallbacks = ref(null);
    const dbSettings = reactive({});
    const loading = ref(true);
    const saving = ref(false);
    const sshKey = ref('');
    const migLoading = reactive({ rbac: false, versions: false });

    const load = async () => {
      try {
        loading.value = true;
        const [c, f] = await Promise.all([API.config.get(), API.config.fallbacks()]);
        config.value = c; fallbacks.value = f;
        Object.assign(dbSettings, {
          TRAEFIK_ENABLED: f.TRAEFIK_ENABLED || 'false',
          TRAEFIK_REMOTE_HOST: f.TRAEFIK_REMOTE_HOST || '',
          TRAEFIK_REMOTE_USER: f.TRAEFIK_REMOTE_USER || '',
          TRAEFIK_REMOTE_PORT: f.TRAEFIK_REMOTE_PORT || '22',
          TRAEFIK_REMOTE_PATH: f.TRAEFIK_REMOTE_PATH || '',
          SERVER_IP: f.SERVER_IP || '',
          LLM_OPENROUTER_API_KEY: '',
          LLM_MODEL: f.LLM_MODEL || '',
          LLM_TEMPERATURE: f.LLM_TEMPERATURE || '0.7',
          LLM_TIMEOUT_SECONDS: f.LLM_TIMEOUT_SECONDS || '30',
          WHITELABEL_NAV: f.WHITELABEL_NAV || 'false',
        });
      } catch { toast('Could not load settings', 'error'); }
      finally { loading.value = false; }
    };

    const runMigRbac = async () => {
      migLoading.rbac = true;
      try { const r = await API.migration.rbac(); toast(r.message || 'RBAC migration done', 'success'); emit('migrated'); }
      catch (e) { toast(e.error || 'Migration failed', 'error'); }
      finally { migLoading.rbac = false; }
    };
    const runMigVersions = async () => {
      migLoading.versions = true;
      try { const r = await API.migration.versions(); toast(r.message || 'Versions migration done', 'success'); emit('migrated'); }
      catch (e) { toast(e.error || 'Migration failed', 'error'); }
      finally { migLoading.versions = false; }
    };

    // Admin domain management
    const newAdminDomain = ref('');
    const adminSaving = ref(false);
    const addAdminDomain = () => {
      if (!newAdminDomain.value.trim() || !config.value) return;
      config.value.domains.push({ domain: newAdminDomain.value.trim(), published: false });
      newAdminDomain.value = '';
    };
    const removeAdminDomain = (i) => { config.value.domains.splice(i, 1); };
    const saveAdminDomains = async () => {
      adminSaving.value = true;
      try { const r = await API.config.updateDomains(config.value.domains); config.value = r.adminConfig || config.value; toast('Domains saved', 'success'); }
      catch (e) { toast(e.error || 'Save failed', 'error'); }
      finally { adminSaving.value = false; }
    };
    const publishAdminDomain = async (d) => {
      adminSaving.value = true;
      try { const r = await API.config.publish(sshKey.value); config.value = r.adminConfig || config.value; toast('Published', 'success'); }
      catch (e) { toast(e.error || 'Publish failed', 'error'); }
      finally { adminSaving.value = false; }
    };
    const unpublishAdminDomain = async (d) => {
      adminSaving.value = true;
      try { const r = await API.config.unpublish(sshKey.value); config.value = r.adminConfig || config.value; toast('Unpublished', 'success'); }
      catch (e) { toast(e.error || 'Unpublish failed', 'error'); }
      finally { adminSaving.value = false; }
    };

    // Save Traefik + LLM settings
    const saveSettings = async () => {
      saving.value = true;
      try {
        const settings = {};
        const keys = ['TRAEFIK_ENABLED', 'TRAEFIK_REMOTE_HOST', 'TRAEFIK_REMOTE_USER', 'TRAEFIK_REMOTE_PORT', 'TRAEFIK_REMOTE_PATH', 'SERVER_IP', 'LLM_OPENROUTER_API_KEY', 'LLM_MODEL', 'LLM_TEMPERATURE', 'LLM_TIMEOUT_SECONDS', 'WHITELABEL_NAV'];
        for (const k of keys) {
          if (dbSettings[k] !== undefined && dbSettings[k] !== '') settings[k] = dbSettings[k];
        }
        if (sshKey.value.trim()) settings.TRAEFIK_SSH_KEY = sshKey.value.trim();
        const r = await API.config.saveSettings(settings);
        toast(`${r.saved} setting(s) saved`, 'success');
        sshKey.value = '';
        dbSettings.LLM_OPENROUTER_API_KEY = '';
        // Reload fallbacks so the Set/Not set badge updates
        const f = await API.config.fallbacks();
        fallbacks.value = f;
        emit('settings-saved');
      } catch (e) { toast(e.error || 'Save failed', 'error'); }
      finally { saving.value = false; }
    };

    // Switch to legacy UI (localStorage flag + redirect)
    const useLegacyUI = () => {
      localStorage.setItem('sl_useLegacyUI', '1');
      window.location.href = '/admin-legacy';
    };

    onMounted(load);
    return { tab, config, fallbacks, dbSettings, loading, saving, sshKey, migLoading, runMigRbac, runMigVersions,
      newAdminDomain, adminSaving, addAdminDomain, removeAdminDomain, saveAdminDomains, publishAdminDomain, unpublishAdminDomain,
      saveSettings, useLegacyUI, emit };
  },
  template: `
    <div class="modal" @click.stop style="max-width:680px">
      <div style="padding:20px 28px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <h2 class="font-serif" style="font-size:20px">Settings</h2>
        <button class="btn btn-ghost" @click="emit('close')" style="padding:4px 8px"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div v-if="loading" style="padding:40px;text-align:center"><p class="text-muted">Loading…</p></div>
      <div v-else style="display:flex;min-height:300px">
        <div style="width:180px;border-right:1px solid var(--border);padding:16px 0">
          <button v-for="t in [{k:'general',l:'General',i:'fa-gear'},{k:'deploy',l:'Deployment',i:'fa-server'},{k:'ai',l:'AI assistant',i:'fa-robot'},{k:'migrate',l:'Migration',i:'fa-arrows-rotate'}]" :key="t.k"
            @click="tab=t.k" style="display:flex;align-items:center;gap:10px;width:100%;padding:10px 20px;border:none;background:transparent;cursor:pointer;font-size:13px"
            :style="tab===t.k?'background:var(--surface-raised);font-weight:500':'color:var(--ink-muted)'">
            <i :class="'fa-solid '+t.i" style="font-size:12px"></i> {{t.l}}</button>
        </div>
        <div style="flex:1;padding:20px 28px">
          <div v-if="tab==='general'">
            <p class="text-muted" style="font-size:13px;margin:0 0 16px">Server-level domains for the admin panel itself. Add, remove, publish, and unpublish here.</p>
            <div v-if="config" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
              <div v-for="(d,i) in config.domains" :key="d.domain" class="card-flat" style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="tag" :class="d.published?'tag-green':'tag-gray'">{{d.published?'Live':'Draft'}}</span>
                  <span class="font-mono" style="font-size:13px">{{d.domain}}</span>
                </div>
                <div style="display:flex;gap:4px">
                  <button v-if="!d.published" class="btn btn-ghost" @click="publishAdminDomain(d)" style="padding:2px 8px;font-size:11px" :disabled="adminSaving">Publish</button>
                  <button v-else class="btn btn-ghost" @click="unpublishAdminDomain(d)" style="padding:2px 8px;font-size:11px" :disabled="adminSaving">Unpublish</button>
                  <button class="btn btn-ghost" @click="removeAdminDomain(i)" style="padding:2px 6px;font-size:11px;color:var(--pastel-red-fg)"><i class="fa-solid fa-trash"></i></button>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:12px">
              <input class="input" v-model="newAdminDomain" placeholder="admin.mysite.com" @keyup.enter="addAdminDomain">
              <button class="btn btn-secondary" @click="addAdminDomain"><i class="fa-solid fa-plus"></i> Add</button>
            </div>
            <button class="btn btn-primary" @click="saveAdminDomains" :disabled="adminSaving">{{adminSaving?'Saving…':'Save domains'}}</button>

            <div v-if="me?.isAdmin" style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border)">
              <h4 style="font-size:14px;font-weight:600;margin:0 0 4px">Whitelabel</h4>
              <p class="text-muted" style="font-size:12px;margin:0 0 12px">When enabled, the top navigation shows the current organization name instead of "SuperLandings". This is useful for multi-tenant deployments where end users do not see the workspace selector.</p>
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px;background:var(--surface-raised);border:1px solid var(--border);border-radius:var(--radius-sm)">
                <input type="checkbox" v-model="dbSettings.WHITELABEL_NAV" true-value="true" false-value="false" style="width:16px;height:16px;cursor:pointer">
                <span style="font-size:13px;font-weight:500">Replace nav brand with organization name</span>
              </label>
            </div>

            <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border)">
              <h4 style="font-size:14px;font-weight:600;margin:0 0 4px">Interface</h4>
              <p class="text-muted" style="font-size:12px;margin:0 0 12px">Switch to the legacy admin interface. Your preference is saved in this browser.</p>
              <button class="btn btn-secondary" @click="useLegacyUI" style="font-size:12px"><i class="fa-solid fa-arrow-rotate-left"></i> Use legacy interface</button>
            </div>
          </div>
          <div v-else-if="tab==='deploy'">
            <p class="text-muted" style="font-size:13px;margin:0 0 16px">Traefik reverse-proxy connection for publishing pages to custom domains.</p>
            <label class="field"><span>Traefik host</span><input class="input font-mono" v-model="dbSettings.TRAEFIK_REMOTE_HOST" placeholder="server.example.com"></label>
            <label class="field"><span>SSH user</span><input class="input font-mono" v-model="dbSettings.TRAEFIK_REMOTE_USER" placeholder="root"></label>
            <label class="field"><span>SSH port</span><input class="input font-mono" v-model="dbSettings.TRAEFIK_REMOTE_PORT"></label>
            <label class="field"><span>Config path</span><input class="input font-mono" v-model="dbSettings.TRAEFIK_REMOTE_PATH" placeholder="/data/coolify/proxy/dynamic"></label>
            <label class="field"><span>SSH private key</span><textarea class="input font-mono" v-model="sshKey" rows="3" style="font-size:11px" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"></textarea></label>
          </div>
          <div v-else-if="tab==='ai'">
            <p class="text-muted" style="font-size:13px;margin:0 0 16px">AI assistant for generating page content and Traefik configs. Uses OpenRouter.</p>
            <label class="field">
              <span style="display:flex;align-items:center;gap:8px">OpenRouter API key
                <span class="tag" :class="fallbacks?.LLM_OPENROUTER_API_KEY?'tag-green':'tag-gray'" style="font-size:9px">{{fallbacks?.LLM_OPENROUTER_API_KEY?'Set':'Not set'}}</span>
              </span>
              <input class="input font-mono" v-model="dbSettings.LLM_OPENROUTER_API_KEY" type="text" autocomplete="off" data-1p-ignore data-lpignore="true" placeholder="sk-or-… (leave empty to keep current)">
            </label>
            <label class="field"><span>Model</span><input class="input font-mono" v-model="dbSettings.LLM_MODEL" placeholder="anthropic/claude-3.5-sonnet"></label>
            <label class="field"><span>Temperature</span><input class="input" v-model="dbSettings.LLM_TEMPERATURE" type="number" min="0" max="2" step="0.1"></label>
          </div>
          <div v-else-if="tab==='migrate'">
            <p class="text-muted" style="font-size:13px;margin:0 0 16px">One-time migration tools. Run these after upgrading SuperLandings to align existing data with the current schema.</p>
            <div class="card-flat" style="padding:16px;margin-bottom:12px">
              <h4 style="font-size:14px;font-weight:600;margin:0 0 4px">RBAC migration</h4>
              <p class="text-muted" style="font-size:12px;margin:0 0 12px">Assigns landings to organizations and ensures all users have an organization.</p>
              <button class="btn btn-secondary" @click="runMigRbac" :disabled="migLoading.rbac">{{migLoading.rbac?'Migrating…':'Run RBAC migration'}}</button>
            </div>
            <div class="card-flat" style="padding:16px">
              <h4 style="font-size:14px;font-weight:600;margin:0 0 4px">Versions migration</h4>
              <p class="text-muted" style="font-size:12px;margin:0 0 12px">Migrates legacy version metadata to the current schema.</p>
              <button class="btn btn-secondary" @click="runMigVersions" :disabled="migLoading.versions">{{migLoading.versions?'Migrating…':'Run versions migration'}}</button>
            </div>
          </div>
        </div>
      </div>
      <div style="padding:16px 28px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-secondary" @click="emit('close')">Close</button>
        <button v-if="tab==='deploy'||tab==='ai'" class="btn btn-primary" @click="saveSettings" :disabled="saving">{{saving?'Saving…':'Save settings'}}</button>
      </div>
    </div>`,
});
