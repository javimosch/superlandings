/* Domains modal — manage custom domains + publish/unpublish + Cloudflare DNS */
app.component('domains-modal', {
  props: ['landing', 'me'],
  emits: ['close', 'toast', 'saved'],
  setup(props, { emit }) {
    const domains = ref([]);
    const newDomain = ref('');
    const loading = ref(true);
    const saving = ref(false);
    const sshKey = ref('');
    const showAdvanced = ref(false);
    // Cloudflare state
    const cfStatus = ref({ enabled: false, connected: false, connectedAt: null, email: null });
    const cfDomainInput = ref('');
    const cfRecap = ref(null);
    const cfLoading = reactive({ connect: false, disconnect: false, configure: false });

    const load = async () => {
      domains.value = (props.landing.domains || []).map(d => ({ ...d }));
      loading.value = false;
      // Load Cloudflare status (user accounts only, not admin)
      if (!props.me?.isAdmin) {
        try { cfStatus.value = await API.cloudflare.status(); } catch {}
      }
    };

    const addDomain = () => {
      if (!newDomain.value.trim()) return;
      domains.value.push({ domain: newDomain.value.trim(), published: false });
      newDomain.value = '';
    };
    const removeDomain = (i) => { domains.value.splice(i, 1); };

    const save = async () => {
      try {
        saving.value = true;
        await API.domains.update(props.landing.id, domains.value);
        toast('Domains saved', 'success');
        emit('saved');
        emit('close');
      } catch (e) { toast(e.error || 'Save failed', 'error'); }
      finally { saving.value = false; }
    };

    const publish = async (d) => {
      try {
        saving.value = true;
        await API.domains.publishOne(props.landing.id, d.domain, sshKey.value);
        d.published = true; toast(`${d.domain} is now live`, 'success');
      } catch (e) { toast(e.error || 'Publish failed', 'error'); }
      finally { saving.value = false; }
    };
    const unpublish = async (d) => {
      try {
        saving.value = true;
        await API.domains.unpublishOne(props.landing.id, d.domain, sshKey.value);
        d.published = false; toast(`${d.domain} taken offline`, 'success');
      } catch (e) { toast(e.error || 'Failed', 'error'); }
      finally { saving.value = false; }
    };
    // Bulk publish/unpublish all domains
    const publishAll = async () => {
      saving.value = true;
      try { const r = await API.domains.publish(props.landing.id, sshKey.value); domains.value = r.landing?.domains || domains.value; toast('All domains published', 'success'); }
      catch (e) { toast(e.error || 'Publish failed', 'error'); }
      finally { saving.value = false; }
    };
    const unpublishAll = async () => {
      saving.value = true;
      try { const r = await API.domains.unpublish(props.landing.id, sshKey.value); domains.value = r.landing?.domains || domains.value; toast('All domains taken offline', 'success'); }
      catch (e) { toast(e.error || 'Failed', 'error'); }
      finally { saving.value = false; }
    };

    // Cloudflare actions
    const cfConnect = async () => {
      cfLoading.connect = true;
      try { await API.cloudflare.connect(); toast('Cloudflare connected', 'success'); cfStatus.value = await API.cloudflare.status(); }
      catch (e) { toast(e.error || 'Connect failed', 'error'); }
      finally { cfLoading.connect = false; }
    };
    const cfDisconnect = async () => {
      cfLoading.disconnect = true;
      try { await API.cloudflare.disconnect(); toast('Cloudflare disconnected', 'success'); cfStatus.value = await API.cloudflare.status(); cfRecap.value = null; }
      catch (e) { toast(e.error || 'Disconnect failed', 'error'); }
      finally { cfLoading.disconnect = false; }
    };
    const cfConfigure = async () => {
      if (!cfDomainInput.value.trim()) return;
      cfLoading.configure = true;
      try {
        const data = await API.cloudflare.configureDns(cfDomainInput.value.trim());
        cfRecap.value = { steps: data.steps || [], info: data.info || '' };
        toast('DNS configured', 'success');
      } catch (e) { toast(e.error || 'DNS configuration failed', 'error'); }
      finally { cfLoading.configure = false; }
    };

    onMounted(load);
    return { domains, newDomain, loading, saving, sshKey, showAdvanced,
      addDomain, removeDomain, save, publish, unpublish, publishAll, unpublishAll,
      cfStatus, cfDomainInput, cfRecap, cfLoading, cfConnect, cfDisconnect, cfConfigure, emit, fmtDate };
  },
  template: `
    <div class="modal" @click.stop style="max-width:560px">
      <div style="padding:20px 28px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div><h2 class="font-serif" style="font-size:20px">Domains</h2><p class="text-muted" style="font-size:12px;margin:2px 0 0">{{landing.name}}</p></div>
        <button class="btn btn-ghost" @click="emit('close')" style="padding:4px 8px"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div style="padding:20px 28px;max-height:60vh;overflow-y:auto">
        <p class="text-muted" style="font-size:13px;margin:0 0 16px">Add custom domains to serve this page from your own URL. Each domain needs a DNS record pointing to the server.</p>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <input class="input" v-model="newDomain" placeholder="mysite.com" @keyup.enter="addDomain">
          <button class="btn btn-secondary" @click="addDomain"><i class="fa-solid fa-plus"></i> Add</button>
        </div>
        <div v-if="domains.length===0" style="padding:24px;text-align:center"><p class="text-muted">No custom domains. The page is served at /{{landing.slug}}.</p></div>
        <div v-else>
          <div style="display:flex;gap:8px;margin-bottom:12px">
            <button class="btn btn-ghost" @click="publishAll" :disabled="saving" style="font-size:12px"><i class="fa-solid fa-rocket"></i> Put all online</button>
            <button class="btn btn-ghost" @click="unpublishAll" :disabled="saving" style="font-size:12px"><i class="fa-solid fa-power-off"></i> Take all offline</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div v-for="(d,i) in domains" :key="d.domain" class="card-flat" style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between">
              <div style="display:flex;align-items:center;gap:10px">
                <span class="tag" :class="d.published?'tag-green':'tag-gray'">{{d.published?'Live':'Draft'}}</span>
                <span class="font-mono" style="font-size:13px">{{d.domain}}</span>
              </div>
              <div style="display:flex;gap:4px">
                <button v-if="!d.published" class="btn btn-secondary" @click="publish(d)" style="padding:4px 12px;font-size:12px">Put online</button>
                <button v-else class="btn btn-secondary" @click="unpublish(d)" style="padding:4px 12px;font-size:12px">Take offline</button>
                <button class="btn btn-ghost" @click="removeDomain(i)" style="padding:4px 8px;color:var(--pastel-red-fg)"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          </div>
        </div>

        <!-- SSH key (advanced) -->
        <div style="margin-top:20px">
          <button class="btn btn-ghost" @click="showAdvanced=!showAdvanced" style="font-size:12px">
            <i :class="showAdvanced?'fa-solid fa-chevron-down':'fa-solid fa-chevron-right'"></i> Advanced (SSH key for publishing)</button>
          <div v-if="showAdvanced" style="margin-top:12px">
            <label class="field"><span>SSH private key (for Traefik deployment)</span>
              <textarea class="input font-mono" v-model="sshKey" rows="3" style="font-size:11px" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"></textarea></label>
          </div>
        </div>

        <!-- Cloudflare DNS automation (user accounts only) -->
        <div v-if="!me?.isAdmin" style="margin-top:24px;padding-top:20px;border-top:1px solid var(--border)">
          <h3 style="font-size:14px;font-weight:600;margin:0 0 4px"><i class="fa-solid fa-cloud" style="margin-right:6px"></i>Cloudflare DNS</h3>
          <p class="text-muted" style="font-size:12px;margin:0 0 12px">Automatically configure DNS records via your Cloudflare account.</p>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <span class="tag" :class="cfStatus.enabled?'tag-blue':'tag-gray'">{{cfStatus.enabled?'Enabled':'Disabled'}}</span>
            <span class="tag" :class="cfStatus.connected?'tag-green':'tag-gray'">{{cfStatus.connected?'Connected':'Not connected'}}</span>
            <span v-if="cfStatus.connectedAt" class="text-faint" style="font-size:11px">since {{fmtDate(cfStatus.connectedAt)}}</span>
          </div>
          <div v-if="!cfStatus.connected" style="margin-bottom:12px">
            <button class="btn btn-secondary" @click="cfConnect" :disabled="cfLoading.connect||!cfStatus.enabled">
              {{cfLoading.connect?'Connecting…':'Connect Cloudflare'}}</button>
            <p v-if="!cfStatus.enabled" class="text-faint" style="font-size:11px;margin-top:4px">Requires CLOUDFLARE_API_TOKEN in server settings.</p>
          </div>
          <div v-else style="margin-bottom:12px">
            <button class="btn btn-ghost" @click="cfDisconnect" :disabled="cfLoading.disconnect" style="font-size:12px;color:var(--pastel-red-fg)">
              {{cfLoading.disconnect?'Disconnecting…':'Disconnect'}}</button>
          </div>
          <div v-if="cfStatus.connected">
            <label class="field"><span>Domain to configure</span>
              <input class="input" v-model="cfDomainInput" placeholder="mysite.com" @keyup.enter="cfConfigure"></label>
            <p class="text-faint" style="font-size:11px;margin:-8px 0 8px">This will remove conflicting records and create: A @, A *, CNAME www → @</p>
            <button class="btn btn-primary" @click="cfConfigure" :disabled="cfLoading.configure||!cfDomainInput.trim()">
              {{cfLoading.configure?'Configuring…':'Configure DNS'}}</button>
          </div>
          <div v-if="cfRecap" style="margin-top:12px;padding:12px;background:var(--surface-raised);border-radius:8px">
            <p style="font-weight:600;font-size:12px;margin:0 0 8px">DNS configuration result:</p>
            <div v-for="(s,i) in cfRecap.steps" :key="i" style="display:flex;gap:8px;padding:4px 0;font-size:12px">
              <span class="tag" :class="s.action==='add'?'tag-green':s.action==='remove'?'tag-red':'tag-gray'" style="font-size:9px">{{s.action}}</span>
              <span>{{s.message}}</span>
            </div>
            <p v-if="cfRecap.info" class="text-muted" style="font-size:11px;margin:8px 0 0">{{cfRecap.info}}</p>
          </div>
        </div>
        <div v-else style="margin-top:24px;padding-top:20px;border-top:1px solid var(--border)">
          <p class="text-faint" style="font-size:12px"><i class="fa-solid fa-info-circle"></i> Cloudflare connection is available for user accounts (not the admin session).</p>
        </div>
      </div>
      <div style="padding:16px 28px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-secondary" @click="emit('close')">Cancel</button>
        <button class="btn btn-primary" @click="save" :disabled="saving">Save domains</button>
      </div>
    </div>`,
});
