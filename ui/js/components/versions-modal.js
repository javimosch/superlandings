/* Versions modal — snapshot history with rollback, diff, tag */
app.component('versions-modal', {
  props: ['landing'],
  emits: ['close', 'toast'],
  setup(props, { emit }) {
    const versions = ref([]);
    const loading = ref(true);
    const newDesc = ref('');
    const creating = ref(false);
    const diffData = ref(null);
    const previewContent = ref(null);
    const previewVersion = ref(null);

    const load = async () => {
      try { loading.value = true; versions.value = await API.versions.list(props.landing.id); }
      catch { toast('Could not load versions', 'error'); }
      finally { loading.value = false; }
    };

    const create = async () => {
      try {
        creating.value = true;
        await API.versions.create(props.landing.id, newDesc.value || 'Manual snapshot');
        newDesc.value = '';
        toast('Snapshot saved', 'success');
        await load();
      } catch { toast('Could not save snapshot', 'error'); }
      finally { creating.value = false; }
    };

    const rollback = async (v) => {
      if (!confirm(`Restore version ${v.versionNumber}? Current content will be replaced.`)) return;
      try { await API.versions.rollback(props.landing.id, v.id); toast('Restored', 'success'); await load(); }
      catch { toast('Restore failed', 'error'); }
    };

    const remove = async (v) => {
      if (!confirm(`Delete version ${v.versionNumber}?`)) return;
      try { await API.versions.delete(props.landing.id, v.id); toast('Version deleted', 'success'); await load(); }
      catch { toast('Delete failed', 'error'); }
    };

    const showDiff = async (v) => {
      try { diffData.value = await API.versions.diff(props.landing.id, v.id, 'previous'); }
      catch { toast('Could not load diff', 'error'); }
    };

    const showPreview = async (v) => {
      try {
        const [data, meta] = await Promise.all([
          API.versions.preview(props.landing.id, v.id),
          API.versions.get(props.landing.id, v.id),
        ]);
        previewContent.value = data.content;
        previewVersion.value = meta || v;
      } catch { toast('Could not load preview', 'error'); }
    };

    const saveTag = async (v, tag) => {
      try { await API.versions.update(props.landing.id, v.id, { tag }); toast('Tag saved', 'success'); await load(); }
      catch { toast('Failed', 'error'); }
    };

    onMounted(load);
    return { versions, loading, newDesc, creating, create, rollback, remove, showDiff, diffData, showPreview, previewContent, previewVersion, saveTag, emit, fmtDate };
  },
  template: `
    <div class="modal" @click.stop style="max-width:640px">
      <div style="padding:20px 28px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div><h2 class="font-serif" style="font-size:20px">Versions</h2><p class="text-muted" style="font-size:12px;margin:2px 0 0">{{landing.name}}</p></div>
        <button class="btn btn-ghost" @click="emit('close')" style="padding:4px 8px"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div style="padding:20px 28px;max-height:55vh;overflow-y:auto">
        <div style="display:flex;gap:8px;margin-bottom:20px">
          <input class="input" v-model="newDesc" placeholder="Snapshot description (optional)" @keyup.enter="create">
          <button class="btn btn-primary" @click="create" :disabled="creating"><i class="fa-solid fa-camera"></i> Snapshot</button>
        </div>
        <div v-if="loading" style="text-align:center;padding:32px"><p class="text-muted">Loading…</p></div>
        <div v-else-if="versions.length===0" style="text-align:center;padding:32px"><p class="text-muted">No versions yet. Save a snapshot to track changes.</p></div>
        <div v-else style="display:flex;flex-direction:column;gap:0">
          <div v-for="v in versions" :key="v.id" style="padding:14px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <span style="font-weight:600;font-size:14px">v{{v.versionNumber}}</span>
                <span v-if="v.tag" class="tag tag-blue" style="margin-left:8px">{{v.tag}}</span>
                <p class="text-muted" style="font-size:12px;margin:4px 0 0">{{v.description||'No description'}} · {{fmtDate(v.createdAt)}}</p>
              </div>
              <div style="display:flex;gap:4px">
                <button class="btn btn-ghost" @click="showPreview(v)" title="Preview" style="padding:4px 8px"><i class="fa-solid fa-eye"></i></button>
                <button class="btn btn-ghost" @click="showDiff(v)" title="Diff" style="padding:4px 8px"><i class="fa-solid fa-code-compare"></i></button>
                <button class="btn btn-ghost" @click="rollback(v)" title="Restore" style="padding:4px 8px"><i class="fa-solid fa-rotate-left"></i></button>
                <button class="btn btn-ghost" @click="remove(v)" title="Delete" style="padding:4px 8px;color:var(--pastel-red-fg)"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="diffData" style="padding:16px 28px;border-top:1px solid var(--border);max-height:200px;overflow:auto;background:var(--surface-raised)">
        <p class="font-mono" style="font-size:11px;margin:0 0 8px;color:var(--ink-muted)">Diff vs {{diffData.compareLabel}}</p>
        <div v-for="d in diffData.diffs" :key="d.filename" class="font-mono" style="font-size:11px">
          <p style="margin:4px 0;font-weight:600">{{d.filename}} <span class="tag" :class="d.type==='added'?'tag-green':d.type==='deleted'?'tag-red':'tag-yellow'">{{d.type}}</span></p>
          <pre v-for="h in d.hunks" :key="h.newStart" style="margin:0 0 8px 12px;white-space:pre-wrap"><span v-for="c in h.changes" :key="c.lineNumber" :style="c.type==='added'?'color:var(--pastel-green-fg)':c.type==='deleted'?'color:var(--pastel-red-fg)':''">{{c.line}}\n</span></pre>
        </div>
      </div>
      <div v-if="previewContent!==null" style="padding:0;border-top:1px solid var(--border);height:300px">
        <iframe :srcdoc="previewContent" style="width:100%;height:100%;border:none" sandbox="allow-same-origin allow-scripts"></iframe>
      </div>
    </div>`,
});
