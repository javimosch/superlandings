/* Editor view — sidebar layout: left = controls, right = preview/code */
app.component('editor-view', {
  props: ['landing'],
  emits: ['close', 'versions', 'domains', 'audit'],
  setup(props, { emit }) {
    const tab = ref('preview'); // preview | code
    const content = ref('');
    const original = ref('');
    const loading = ref(true);
    const saving = ref(false);
    const aiPrompt = ref('');
    const generatingAi = ref(false);
    const showAi = ref(false);
    const aiSummary = ref('');
    const editEjsFiles = ref([]);
    const editEjsZip = ref(null);
    const editVirtualFiles = ref([]);
    const showFileUpload = ref(false);
    const editorMode = ref('ai'); // ai | code | blocks (HTML landings only)
    const blockData = ref([]);
    const previewWidth = ref('100%'); // 100% | <number>px
    const previewWidthNumber = computed(() => previewWidth.value === '100%' ? 1400 : parseInt(previewWidth.value) || 375);
    let editor = null;

    const isHtml = computed(() => props.landing.type === 'html');
    const isTraefik = computed(() => props.landing.type === 'traefik-config');
    const isEjs = computed(() => props.landing.type === 'ejs');
    const isVirtual = computed(() => props.landing.type === 'virtual');
    const dirty = computed(() => content.value !== original.value);

    const load = async () => {
      try {
        loading.value = true;
        const data = await API.landings.get(props.landing.id);
        content.value = data.content || '';
        original.value = content.value;
        blockData.value = data.blockData || [];
        // Keep editorMode as-is (default 'ai'); user can switch to blocks via the mode toggle
      } catch (e) { toast('Could not load page content', 'error'); }
      finally { loading.value = false; }
    };

    const initEditor = () => {
      nextTick(() => {
        const el = document.getElementById('codemirror-editor');
        if (!el) return;
        if (editor) { editor.setValue(content.value); nextTick(() => editor.refresh()); return; }
        editor = CodeMirror(el, {
          value: content.value,
          mode: isTraefik.value ? 'yaml' : 'htmlmixed',
          lineWrapping: true, lineNumbers: true,
        });
        editor.on('change', () => { content.value = editor.getValue(); });
      });
    };

    const switchTab = (t) => {
      tab.value = t;
      if (t === 'code') { if (!editor) initEditor(); else nextTick(() => editor.refresh()); }
    };

    const save = async () => {
      if (editor) content.value = editor.getValue();
      saving.value = true;
      try {
        await API.landings.update(props.landing.id, { content: content.value });
        original.value = content.value;
        toast('Saved', 'success');
      } catch (e) { toast(e.error || 'Save failed', 'error'); }
      finally { saving.value = false; }
    };

    const runAiEdit = async (newContent, aiSummary) => {
      content.value = newContent; original.value = newContent;
      if (editor) editor.setValue(newContent);
      // Auto-save the AI-applied changes
      try {
        await API.landings.update(props.landing.id, { content: newContent });
        toast(aiSummary || 'AI changes applied and saved', 'success');
      } catch (e) { toast(e.error || 'Save after AI edit failed', 'error'); }
    };

    const revertAiEdit = (originalContent) => {
      content.value = originalContent; original.value = originalContent;
      if (editor) editor.setValue(originalContent);
      toast('Changes reverted', 'info');
    };

    // Save from block editor — stores both compiled HTML and block JSON
    const saveBlocks = async (html, blocks) => {
      saving.value = true;
      try {
        await API.landings.update(props.landing.id, { content: html, blockData: blocks });
        content.value = html; original.value = html;
        blockData.value = blocks;
        toast('Page saved', 'success');
      } catch (e) { toast(e.error || 'Save failed', 'error'); }
      finally { saving.value = false; }
    };

    // Switch editor mode (Blocks / AI / Code)
    const switchMode = (m) => {
      editorMode.value = m;
      if (m === 'code') { tab.value = 'code'; nextTick(() => { if (!editor) initEditor(); else editor.refresh(); }); }
      else if (m === 'ai') { tab.value = 'preview'; }
      else if (m === 'blocks') {
        tab.value = 'preview';
        // If no block data yet, try to infer blocks from the current HTML
        if (!blockData.value?.length && content.value) {
          try {
            const inferred = window.SL_PARSE(content.value);
            if (inferred?.length) blockData.value = inferred;
          } catch (err) {
            console.error('Block inference failed:', err);
          }
        }
      }
    };

    // Start fresh with blocks (clears existing HTML content)
    const startBlocks = () => {
      blockData.value = [];
      editorMode.value = 'blocks';
    };

    const runAiGenerate = async (promptText) => {
      const p = promptText || aiPrompt.value;
      if (!p?.trim()) return;
      generatingAi.value = true;
      try {
        const data = await API.landings.generateTraefik(p, props.landing.slug, props.landing.domains || []);
        content.value = data.yaml; original.value = data.yaml;
        if (editor) editor.setValue(data.yaml);
        aiPrompt.value = '';
        toast('Traefik configuration generated', 'success');
      } catch (e) { toast(e.error || 'AI generation failed', 'error'); }
      finally { generatingAi.value = false; }
    };

    const handleEjsFiles = (e) => { editEjsFiles.value = Array.from(e.target.files); editEjsZip.value = null; };
    const handleEjsZip = (e) => { editEjsZip.value = e.target.files[0]; editEjsFiles.value = []; };
    const handleVirtualFiles = (e) => { editVirtualFiles.value = Array.from(e.target.files); };

    const uploadFiles = async () => {
      const fd = new FormData();
      if (isEjs.value) {
        if (editEjsZip.value) fd.append('files', editEjsZip.value);
        else editEjsFiles.value.forEach(f => fd.append('files', f));
      } else if (isVirtual.value) {
        editVirtualFiles.value.forEach(file => {
          const parts = (file.webkitRelativePath || file.name).split('/');
          parts.shift();
          const rel = parts.join('/') || file.name;
          fd.append('files', file, rel);
        });
      }
      if (!fd.has('files')) { toast('No files selected', 'error'); return; }
      saving.value = true;
      try {
        await API.landings.updateForm(props.landing.id, fd);
        toast('Files updated', 'success');
        editEjsFiles.value = []; editEjsZip.value = null; editVirtualFiles.value = [];
        showFileUpload.value = false;
        await load();
      } catch (e) { toast(e.error || 'Upload failed', 'error'); }
      finally { saving.value = false; }
    };

    const previewSrc = computed(() => {
      const blob = new Blob([content.value || ''], { type: 'text/html' });
      return URL.createObjectURL(blob);
    });

    const openPreviewTab = () => {
      const w = window.open('', '_blank');
      w.document.write(content.value); w.document.close();
    };

    onMounted(load);
    watch(() => props.landing?.id, load);

    return {
      tab, content, loading, saving, dirty, save, switchTab, previewSrc, openPreviewTab, previewWidth, previewWidthNumber, emit,
      aiPrompt, generatingAi, showAi, aiSummary, runAiEdit, revertAiEdit, runAiGenerate, toast,
      isHtml, isTraefik, isEjs, isVirtual,
      editEjsFiles, editEjsZip, editVirtualFiles, showFileUpload,
      handleEjsFiles, handleEjsZip, handleVirtualFiles, uploadFiles, fmtDate,
      editorMode, blockData, saveBlocks, switchMode, startBlocks,
    };
  },
  template: `
    <div style="display:flex;gap:16px;height:calc(100vh - 80px);align-items:stretch">

      <!-- Block editor mode (HTML only) -->
      <block-editor v-if="isHtml && editorMode==='blocks'" :blockData="blockData" :landing="landing" :mode="editorMode"
        style="flex:1;min-width:0" @save="saveBlocks" @toast="(m,t)=>toast(m,t)" @switch-mode="switchMode"></block-editor>

      <!-- AI / Code mode (or non-HTML types) -->
      <template v-else>

      <!-- Left sidebar: metadata + actions + AI + code -->
      <div style="width:280px;flex-shrink:0;display:flex;flex-direction:column;gap:10px;overflow-y:auto;padding-right:4px">

        <div>
          <h1 class="font-serif" style="font-size:22px;letter-spacing:-0.02em;line-height:1.2;margin:0">{{landing.name}}</h1>
          <p class="font-mono text-muted" style="font-size:12px;margin:4px 0 0">/{{landing.slug}}</p>
        </div>

        <!-- Mode toggle (HTML landings only) -->
        <div v-if="isHtml" style="display:flex;gap:0;border:1px solid var(--border);border-radius:6px;overflow:hidden">
          <button @click="switchMode('blocks')" :style="editorMode==='blocks'?'background:var(--accent);color:#fff;border:none;padding:6px 0;font-size:11px;flex:1;cursor:pointer':'background:transparent;border:none;padding:6px 0;font-size:11px;flex:1;cursor:pointer;color:var(--ink-muted)'">
            <i class="fa-solid fa-cubes"></i> Blocks</button>
          <button @click="switchMode('ai')" :style="editorMode==='ai'?'background:var(--accent);color:#fff;border:none;padding:6px 0;font-size:11px;flex:1;cursor:pointer':'background:transparent;border:none;padding:6px 0;font-size:11px;flex:1;cursor:pointer;color:var(--ink-muted)'">
            <i class="fa-solid fa-wand-magic-sparkles"></i> AI</button>
          <button @click="switchMode('code')" :style="editorMode==='code'?'background:var(--accent);color:#fff;border:none;padding:6px 0;font-size:11px;flex:1;cursor:pointer':'background:transparent;border:none;padding:6px 0;font-size:11px;flex:1;cursor:pointer;color:var(--ink-muted)'">
            <i class="fa-solid fa-code"></i> Code</button>
        </div>

        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <span v-if="dirty" class="tag tag-yellow">Unsaved</span>
          <button class="btn btn-secondary" @click="emit('versions',landing)" style="font-size:12px;padding:6px 10px"><i class="fa-solid fa-clock-rotate-left"></i> Versions</button>
          <button class="btn btn-secondary" @click="emit('domains',landing)" style="font-size:12px;padding:6px 10px"><i class="fa-solid fa-globe"></i> Domains</button>
          <button class="btn btn-secondary" @click="emit('audit',landing)" style="font-size:12px;padding:6px 10px"><i class="fa-solid fa-list"></i> History</button>
        </div>

        <button v-if="isHtml||isTraefik" class="btn btn-primary" @click="save" :disabled="saving||!dirty" style="width:100%">
          <i class="fa-solid fa-floppy-disk"></i> {{saving?'Saving…':'Save changes'}}
        </button>

        <!-- AI Assistant (HTML only — Traefik uses free-text generate) -->
        <ai-assistant v-if="isHtml" :landing="landing" :content="content"
          @applied="runAiEdit" @reverted="revertAiEdit" @toast="(m,t)=>toast(m,t)"></ai-assistant>

        <!-- Traefik AI generate (free-text only) -->
        <div v-if="isTraefik" class="card" style="padding:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer" @click="showAi=!showAi">
            <span style="font-size:13px;font-weight:600"><i class="fa-solid fa-wand-magic-sparkles" style="margin-right:6px"></i>AI generate</span>
            <i :class="showAi?'fa-solid fa-chevron-up':'fa-solid fa-chevron-down'" style="font-size:10px;color:var(--ink-muted)"></i>
          </div>
          <div v-if="showAi" style="margin-top:10px">
            <textarea class="input" v-model="aiPrompt" rows="3" style="font-size:12px" placeholder="Reverse proxy /api to 10.0.0.5:8080" @keyup.ctrl.enter="runAiGenerate()"></textarea>
            <button class="btn btn-primary" @click="runAiGenerate()" :disabled="generatingAi||!aiPrompt.trim()" style="width:100%;margin-top:6px;font-size:12px">
              <i class="fa-solid fa-wand-magic-sparkles"></i> {{generatingAi?'Thinking…':'Generate config'}}</button>
          </div>
        </div>

        <!-- File upload for EJS/Virtual -->
        <div v-if="isEjs||isVirtual" class="card" style="padding:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer" @click="showFileUpload=!showFileUpload">
            <span style="font-size:13px;font-weight:600"><i class="fa-solid fa-upload" style="margin-right:6px"></i>Update files</span>
            <i :class="showFileUpload?'fa-solid fa-chevron-up':'fa-solid fa-chevron-down'" style="font-size:10px;color:var(--ink-muted)"></i>
          </div>
          <div v-if="showFileUpload" style="margin-top:10px">
            <div v-if="isEjs">
              <label class="field" style="margin:0 0 8px"><span style="font-size:11px">EJS files (multiple)</span>
                <input type="file" multiple accept=".ejs,.html" @change="handleEjsFiles" class="input" style="font-size:11px"></label>
              <label class="field" style="margin:0 0 8px"><span style="font-size:11px">Or ZIP archive</span>
                <input type="file" accept=".zip" @change="handleEjsZip" class="input" style="font-size:11px"></label>
            </div>
            <div v-else>
              <label class="field" style="margin:0 0 8px"><span style="font-size:11px">Select folder</span>
                <input type="file" webkitdirectory directory multiple @change="handleVirtualFiles" class="input" style="font-size:11px"></label>
              <p v-if="editVirtualFiles.length" class="text-muted" style="font-size:11px">{{editVirtualFiles.length}} files selected</p>
            </div>
            <button class="btn btn-primary" @click="uploadFiles" :disabled="saving" style="width:100%;font-size:12px">{{saving?'Uploading…':'Upload files'}}</button>
          </div>
        </div>

        <!-- EJS/Virtual info -->
        <div v-if="isEjs||isVirtual" class="card" style="padding:16px;text-align:center">
          <i class="fa-regular fa-folder-open" style="font-size:24px;color:var(--ink-faint);margin-bottom:8px"></i>
          <p style="font-size:13px;font-weight:600;margin:0 0 4px">{{isEjs?'Multi-page EJS site':'Virtual file collection'}}</p>
          <p class="text-muted" style="font-size:12px;margin:0 0 8px">Use "Update files" above to replace content.</p>
          <p class="text-faint" style="font-size:11px;margin:0">Current version: v{{landing.currentVersionNumber||'—'}}</p>
        </div>
      </div>

      <!-- Right pane: preview / code tabs -->
      <div v-if="isHtml||isTraefik" style="flex:1;display:flex;flex-direction:column;min-width:0">
        <div style="display:flex;align-items:center;gap:0;border-bottom:1px solid var(--border);margin-bottom:0;flex-shrink:0">
          <button @click="switchTab('preview')" :style="tab==='preview'?'background:var(--surface);border:1px solid var(--border);border-bottom:1px solid var(--surface);border-radius:4px 4px 0 0;padding:8px 16px;font-weight:500;font-size:13px':'background:transparent;border:none;padding:8px 16px;color:var(--ink-muted);cursor:pointer;font-size:13px'">
            <i class="fa-solid fa-eye"></i> Preview</button>
          <button @click="switchTab('code')" :style="tab==='code'?'background:var(--surface);border:1px solid var(--border);border-bottom:1px solid var(--surface);border-radius:4px 4px 0 0;padding:8px 16px;font-weight:500;font-size:13px':'background:transparent;border:none;padding:8px 16px;color:var(--ink-muted);cursor:pointer;font-size:13px'">
            <i class="fa-solid fa-code"></i> Code</button>
          <div style="flex:1"></div>
          <button v-if="tab==='preview'" class="btn btn-ghost" @click="openPreviewTab" style="margin:4px 0;font-size:12px"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open in new tab</button>
        </div>

        <div v-if="loading" style="flex:1;display:flex;align-items:center;justify-content:center"><p class="text-muted">Loading…</p></div>

        <div v-else-if="tab==='preview'" style="flex:1;display:flex;flex-direction:column;border:1px solid var(--border);border-top:none;border-radius:0 0 6px 6px;overflow:hidden">
          <div style="display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--surface)">
            <button class="btn btn-ghost" @click="previewWidth='375px'" :style="previewWidth==='375px'?'background:var(--accent);color:#fff;padding:4px 8px;font-size:11px;border:none;border-radius:4px':'padding:4px 8px;font-size:11px;background:transparent;border:none;color:var(--ink-muted);cursor:pointer'" title="Mobile"><i class="fa-solid fa-mobile-screen"></i> 375px</button>
            <button class="btn btn-ghost" @click="previewWidth='768px'" :style="previewWidth==='768px'?'background:var(--accent);color:#fff;padding:4px 8px;font-size:11px;border:none;border-radius:4px':'padding:4px 8px;font-size:11px;background:transparent;border:none;color:var(--ink-muted);cursor:pointer'" title="Tablet"><i class="fa-solid fa-tablet-screen-button"></i> 768px</button>
            <button class="btn btn-ghost" @click="previewWidth='100%'" :style="previewWidth==='100%'?'background:var(--accent);color:#fff;padding:4px 8px;font-size:11px;border:none;border-radius:4px':'padding:4px 8px;font-size:11px;background:transparent;border:none;color:var(--ink-muted);cursor:pointer'" title="Desktop"><i class="fa-solid fa-desktop"></i> 100%</button>
            <input type="range" min="320" max="1400" step="1" :value="previewWidthNumber" @input="previewWidth=$event.target.value+'px'" style="flex:1;min-width:80px" title="Drag to resize">
            <span style="font-size:11px;color:var(--ink-muted);min-width:50px;text-align:right">{{previewWidth}}</span>
          </div>
          <div style="flex:1;overflow:auto;display:flex;justify-content:center;background:var(--canvas)">
            <iframe :src="previewSrc" :style="{ width: previewWidth, height: '100%', border: 'none', background: '#fff' }" sandbox="allow-same-origin allow-scripts allow-popups"></iframe>
          </div>
        </div>

        <!-- Code editor + mobile preview split -->
        <div v-show="tab==='code'" style="flex:1;display:flex;gap:12px;min-height:0">
          <div id="codemirror-editor" style="flex:1;min-width:0;border:1px solid var(--border);border-top:none;border-radius:0 0 6px 6px;overflow:hidden"></div>
          <div style="width:390px;flex-shrink:0;display:flex;flex-direction:column;border:1px solid var(--border);border-top:none;border-radius:0 0 6px 6px;overflow:hidden;background:var(--surface)">
            <div style="padding:6px 12px;border-bottom:1px solid var(--border);font-size:12px;font-weight:600"><i class="fa-solid fa-mobile-screen"></i> Mobile preview</div>
            <div style="flex:1;overflow:auto;display:flex;justify-content:center;background:var(--canvas)">
              <iframe :srcdoc="content" style="width:375px;height:100%;border:none;background:#fff" sandbox="allow-same-origin allow-scripts allow-popups"></iframe>
            </div>
          </div>
        </div>
      </div>

      <!-- EJS/Virtual: no right pane, just sidebar -->
      <div v-else style="flex:1;display:flex;align-items:center;justify-content:center">
        <div v-if="loading" style="text-align:center"><p class="text-muted">Loading…</p></div>
        <div v-else style="text-align:center;max-width:400px">
          <i class="fa-regular fa-folder-open" style="font-size:48px;color:var(--ink-faint);margin-bottom:16px"></i>
          <h3 class="font-serif" style="font-size:20px;margin-bottom:8px">{{isEjs?'Multi-page EJS site':'Virtual file collection'}}</h3>
          <p class="text-muted" style="margin-bottom:16px">This page type uses uploaded files. Use "Update files" in the sidebar to replace content.</p>
          <p class="text-faint" style="font-size:12px">Current version: v{{landing.currentVersionNumber||'—'}}</p>
        </div>
      </div>

      </template>
    </div>`,
});
