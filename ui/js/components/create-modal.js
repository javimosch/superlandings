/* Create landing modal — guided form with file upload for EJS/virtual */
app.component('create-modal', {
  props: ['me', 'currentOrg'],
  emits: ['close', 'created', 'toast'],
  setup(props, { emit }) {
    const form = reactive({ name: '', slug: '', type: 'html', domains: '', content: '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>My Page</title>\n</head>\n<body>\n  <h1>Hello, world.</h1>\n</body>\n</html>' });
    const loading = ref(false);
    // File state
    const ejsFiles = ref([]);
    const ejsZip = ref(null);
    const virtualFiles = ref([]);
    const traefikAiPrompt = ref('');
    const generatingAi = ref(false);

    const types = [
      { value: 'html', label: 'Web page', desc: 'A single HTML page — the simplest option', icon: 'fa-file' },
      { value: 'ejs', label: 'Multi-page site', desc: 'Multiple pages with shared layout (EJS)', icon: 'fa-folder' },
      { value: 'virtual', label: 'Virtual files', desc: 'Upload a folder or zip of files', icon: 'fa-box' },
      { value: 'traefik-config', label: 'Routing rule', desc: 'Advanced: custom Traefik YAML config', icon: 'fa-route' },
    ];

    watch(() => form.name, (n) => { if (!form.slug || form.slug === slugify(form.name)) form.slug = slugify(n); });

    const handleEjsFiles = (e) => { ejsFiles.value = Array.from(e.target.files); ejsZip.value = null; };
    const handleEjsZip = (e) => { ejsZip.value = e.target.files[0]; ejsFiles.value = []; };
    const handleVirtualFiles = (e) => { virtualFiles.value = Array.from(e.target.files); };

    const runAiGenerate = async () => {
      if (!traefikAiPrompt.value.trim()) return;
      generatingAi.value = true;
      try {
        const domains = form.domains.split(',').map(d => d.trim()).filter(Boolean).map(d => ({ domain: d, published: false }));
        const data = await API.landings.generateTraefik(traefikAiPrompt.value, form.slug || 'my-page', domains);
        form.content = data.yaml;
        toast('Config generated', 'success');
      } catch (e) { toast(e.error || 'AI generation failed', 'error'); }
      finally { generatingAi.value = false; }
    };

    const submit = async () => {
      if (!form.name || !form.slug) { toast('Name and URL are required', 'error'); return; }
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('slug', form.slug);
      fd.append('type', form.type);
      if (props.currentOrg) fd.append('organizationId', props.currentOrg.id);
      const domains = form.domains.split(',').map(d => d.trim()).filter(Boolean).map(d => ({ domain: d, published: false }));
      fd.append('domains', JSON.stringify(domains));
      if (form.type === 'html' || form.type === 'traefik-config') fd.append('content', form.content);
      if (form.type === 'ejs') {
        if (ejsZip.value) fd.append('files', ejsZip.value);
        else ejsFiles.value.forEach(f => fd.append('files', f));
      } else if (form.type === 'virtual') {
        virtualFiles.value.forEach(file => {
          const parts = (file.webkitRelativePath || file.name).split('/');
          parts.shift();
          const rel = parts.join('/') || file.name;
          fd.append('files', file, rel);
        });
      }
      try {
        loading.value = true;
        await API.landings.create(fd);
        toast('Page created', 'success');
        emit('created'); emit('close');
      } catch (e) { toast(e.error || 'Create failed', 'error'); }
      finally { loading.value = false; }
    };

    return { form, loading, types, ejsFiles, ejsZip, virtualFiles, traefikAiPrompt, generatingAi,
      handleEjsFiles, handleEjsZip, handleVirtualFiles, runAiGenerate, submit, emit };
  },
  template: `
    <div class="modal" @click.stop>
      <div style="padding:24px 32px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <h2 class="font-serif" style="font-size:22px;letter-spacing:-0.02em">Create a new page</h2>
        <button class="btn btn-ghost" @click="emit('close')" style="padding:4px 8px"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div style="padding:24px 32px;max-height:60vh;overflow-y:auto">
        <label class="field"><span>Page name</span>
          <input class="input" v-model="form.name" placeholder="My landing page" autofocus></label>
        <label class="field"><span>Web address (URL slug)</span>
          <input class="input font-mono" v-model="form.slug" placeholder="my-page">
          <p class="text-faint" style="font-size:11px;margin-top:4px">Will be served at /{{form.slug || '…'}}</p></label>
        <label class="field"><span>Type</span>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <label v-for="t in types" :key="t.value" style="display:flex;gap:10px;padding:12px;border:1px solid var(--border);border-radius:8px;cursor:pointer"
              :style="form.type===t.value?'border-color:var(--ink);background:var(--surface-raised)':''">
              <input type="radio" :value="t.value" v-model="form.type" style="margin-top:3px">
              <div><div style="font-weight:500;font-size:13px"><i :class="'fa-solid '+t.icon" style="margin-right:6px"></i>{{t.label}}</div>
                <div class="text-muted" style="font-size:11px;margin-top:2px">{{t.desc}}</div></div>
            </label>
          </div></label>

        <!-- HTML / Traefik content -->
        <label class="field" v-if="form.type==='html'"><span>Starting content</span>
          <textarea class="input font-mono" v-model="form.content" rows="6" style="font-size:12px"></textarea></label>

        <!-- Traefik AI generation -->
        <div v-if="form.type==='traefik-config'" style="margin-bottom:16px">
          <label class="field"><span>AI assistant — describe the routing config</span>
            <textarea class="input" v-model="traefikAiPrompt" rows="2" placeholder="Reverse proxy /api to 10.0.0.5:8080" @keyup.ctrl.enter="runAiGenerate"></textarea></label>
          <button class="btn btn-secondary" @click="runAiGenerate" :disabled="generatingAi" style="margin-bottom:12px">
            <i class="fa-solid fa-wand-magic-sparkles"></i> {{generatingAi?'Generating…':'Generate with AI'}}</button>
          <label class="field"><span>YAML config</span>
            <textarea class="input font-mono" v-model="form.content" rows="8" style="font-size:12px"></textarea></label>
        </div>

        <!-- EJS upload -->
        <div v-if="form.type==='ejs'">
          <label class="field"><span>Upload EJS files (multiple)</span>
            <input type="file" multiple accept=".ejs,.html" @change="handleEjsFiles" class="input"></label>
          <label class="field"><span>Or upload as ZIP</span>
            <input type="file" accept=".zip" @change="handleEjsZip" class="input"></label>
          <p v-if="ejsFiles.length" class="text-muted" style="font-size:12px">{{ejsFiles.length}} files selected</p>
          <p v-if="ejsZip" class="text-muted" style="font-size:12px">ZIP: {{ejsZip.name}}</p>
        </div>

        <!-- Virtual upload -->
        <div v-if="form.type==='virtual'">
          <label class="field"><span>Select folder to upload</span>
            <input type="file" webkitdirectory directory multiple @change="handleVirtualFiles" class="input"></label>
          <p v-if="virtualFiles.length" class="text-muted" style="font-size:12px">{{virtualFiles.length}} files selected</p>
        </div>

        <label class="field"><span>Custom domains <span class="text-faint">(optional, comma-separated)</span></span>
          <input class="input" v-model="form.domains" placeholder="mysite.com, www.mysite.com"></label>
      </div>
      <div style="padding:16px 32px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-secondary" @click="emit('close')">Cancel</button>
        <button class="btn btn-primary" @click="submit" :disabled="loading">{{loading?'Creating…':'Create page'}}</button>
      </div>
    </div>`,
});
