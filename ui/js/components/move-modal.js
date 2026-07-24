/* Move landing modal — transfer a page to another workspace (admin only) */
app.component('move-modal', {
  props: ['landing', 'orgs', 'currentOrg'],
  emits: ['close', 'moved', 'toast'],
  setup(props, { emit }) {
    const targetOrgId = ref('');
    const moving = ref(false);
    const targets = computed(() => (props.orgs || []).filter(o => o.id !== props.currentOrg?.id));

    const move = async () => {
      if (!targetOrgId.value) { toast('Select a target workspace', 'error'); return; }
      moving.value = true;
      try {
        await API.migration.moveLanding(props.landing.id, targetOrgId.value);
        toast('Page moved', 'success');
        emit('moved'); emit('close');
      } catch (e) { toast(e.error || 'Move failed', 'error'); }
      finally { moving.value = false; }
    };
    return { targetOrgId, moving, targets, move, emit };
  },
  template: `
    <div class="modal" @click.stop style="max-width:440px">
      <div style="padding:20px 28px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <h2 class="font-serif" style="font-size:20px">Move page</h2>
        <button class="btn btn-ghost" @click="emit('close')" style="padding:4px 8px"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div style="padding:24px 28px">
        <p class="text-muted" style="font-size:13px;margin:0 0 16px">Move <strong>{{landing.name}}</strong> to another workspace. This transfers ownership and access.</p>
        <label class="field"><span>Target workspace</span>
          <select class="input" v-model="targetOrgId">
            <option value="" disabled>Select a workspace…</option>
            <option v-for="o in targets" :key="o.id" :value="o.id">{{o.name}}</option>
          </select></label>
      </div>
      <div style="padding:16px 28px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-secondary" @click="emit('close')">Cancel</button>
        <button class="btn btn-primary" @click="move" :disabled="moving||!targetOrgId">{{moving?'Moving…':'Move page'}}</button>
      </div>
    </div>`,
});
