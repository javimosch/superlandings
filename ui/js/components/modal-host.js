/* Modal host — routes to the right modal component */
app.component('modal-host', {
  props: ['modal', 'me', 'orgs', 'currentOrg'],
  emits: ['close', 'created', 'moved', 'saved', 'toast', 'migrated', 'settings-saved'],
  setup(props, { emit }) {
    return { emit };
  },
  template: `
    <div class="modal-overlay" @click.self="emit('close')">
      <create-modal v-if="modal.name==='create'" :me="me" :current-org="currentOrg"
        @close="emit('close')" @created="emit('created')" @toast="(m,t)=>emit('toast',m,t)"></create-modal>
      <versions-modal v-else-if="modal.name==='versions'" :landing="modal.data"
        @close="emit('close')" @toast="(m,t)=>emit('toast',m,t)"></versions-modal>
      <domains-modal v-else-if="modal.name==='domains'" :landing="modal.data" :me="me"
        @close="emit('close')" @saved="emit('saved')" @toast="(m,t)=>emit('toast',m,t)"></domains-modal>
      <audit-modal v-else-if="modal.name==='audit'" :landing="modal.data"
        @close="emit('close')"></audit-modal>
      <settings-modal v-else-if="modal.name==='settings'" :me="me" :orgs="orgs"
        @close="emit('close')" @toast="(m,t)=>emit('toast',m,t)" @migrated="emit('migrated')" @settings-saved="emit('settings-saved')"></settings-modal>
      <organizations-modal v-else-if="modal.name==='organizations'" :me="me" :orgs="orgs"
        @close="emit('close')" @toast="(m,t)=>emit('toast',m,t)"></organizations-modal>
      <move-modal v-else-if="modal.name==='move'" :landing="modal.data" :orgs="orgs" :current-org="currentOrg"
        @close="emit('close')" @moved="emit('moved')" @toast="(m,t)=>emit('toast',m,t)"></move-modal>
    </div>`,
});
