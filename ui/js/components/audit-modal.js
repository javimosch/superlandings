/* Audit modal — chronological activity log */
app.component('audit-modal', {
  props: ['landing'],
  emits: ['close'],
  setup(props, { emit }) {
    const entries = ref([]);
    const total = ref(0);
    const hasMore = ref(false);
    const offset = ref(0);
    const loading = ref(true);
    const actionLabels = {
      create: 'Created', update: 'Updated', delete: 'Deleted', publish: 'Published', unpublish: 'Unpublished',
      rollback: 'Restored', version_create: 'Snapshot saved', version_delete: 'Snapshot deleted',
      version_tag: 'Tagged', domain_add: 'Domain added', domain_remove: 'Domain removed',
      domain_publish: 'Domain published', domain_unpublish: 'Domain taken offline', move: 'Moved',
    };
    const load = async () => {
      try {
        loading.value = true;
        const data = await API.audit.list(props.landing.id, 50, offset.value);
        entries.value = offset.value === 0 ? data.entries : [...entries.value, ...data.entries];
        total.value = data.total;
        hasMore.value = data.hasMore;
      } catch { toast('Could not load history', 'error'); }
      finally { loading.value = false; }
    };
    const loadMore = () => { offset.value += 50; load(); };
    onMounted(load);
    return { entries, total, hasMore, loading, loadMore, actionLabels, emit, fmtDate, fmtRel };
  },
  template: `
    <div class="modal" @click.stop style="max-width:600px">
      <div style="padding:20px 28px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div><h2 class="font-serif" style="font-size:20px">History</h2><p class="text-muted" style="font-size:12px;margin:2px 0 0">{{landing.name}} · {{total}} events</p></div>
        <button class="btn btn-ghost" @click="emit('close')" style="padding:4px 8px"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div style="padding:20px 28px;max-height:55vh;overflow-y:auto">
        <div v-if="loading&&entries.length===0" style="text-align:center;padding:32px"><p class="text-muted">Loading…</p></div>
        <div v-else-if="entries.length===0" style="text-align:center;padding:32px"><p class="text-muted">No activity yet.</p></div>
        <div v-else style="display:flex;flex-direction:column;gap:0">
          <div v-for="e in entries" :key="e.id" style="padding:12px 0;border-bottom:1px solid var(--border);display:flex;gap:12px">
            <div style="width:8px;height:8px;border-radius:50%;background:var(--ink-muted);margin-top:6px;flex-shrink:0"></div>
            <div style="flex:1">
              <p style="margin:0;font-size:13px;font-weight:500">{{actionLabels[e.action]||e.action}}</p>
              <p class="text-muted" style="font-size:12px;margin:2px 0 0">{{e.details||''}}</p>
              <p class="text-faint" style="font-size:11px;margin:2px 0 0">{{e.actor||'system'}} · {{fmtRel(e.createdAt)}}</p>
            </div>
          </div>
        </div>
        <div v-if="hasMore" style="text-align:center;padding:16px"><button class="btn btn-secondary" @click="loadMore" :disabled="loading">Load more</button></div>
      </div>
    </div>`,
});
