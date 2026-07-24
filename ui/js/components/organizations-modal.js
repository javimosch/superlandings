/* Organizations modal — team, workspace, and user management (admin only) */
app.component('organizations-modal', {
  props: ['me', 'orgs'],
  emits: ['close', 'toast'],
  setup(props, { emit }) {
    const orgList = ref([]);
    const allUsers = ref([]);
    const availableRights = ref([]);
    const loading = ref(true);
    const newOrgName = ref('');
    const showAddUser = ref(null);
    const newUserEmail = ref('');
    const newUserRights = ref([]);
    // Standalone user creation
    const newUEmail = ref('');
    const newUPassword = ref('');
    const creatingUser = ref(false);
    // User rights editor
    const editingRights = ref(null); // { orgId, orgName, email, rights }
    const tab = ref('workspaces'); // workspaces | users

    const load = async () => {
      try {
        loading.value = true;
        // Load independently so one failure doesn't kill everything
        const results = await Promise.allSettled([API.orgs.list(), API.users.list(), API.users.rights()]);
        if (results[0].status === 'fulfilled') orgList.value = results[0].value;
        else toast('Could not load workspaces: ' + (results[0].reason?.error || 'error'), 'error');
        if (results[1].status === 'fulfilled') allUsers.value = results[1].value;
        else toast('Could not load users: ' + (results[1].reason?.error || 'error'), 'error');
        if (results[2].status === 'fulfilled') availableRights.value = results[2].value;
      } finally { loading.value = false; }
    };

    const createOrg = async () => {
      if (!newOrgName.value.trim()) return;
      try { await API.orgs.create(newOrgName.value); newOrgName.value = ''; toast('Workspace created', 'success'); await load(); }
      catch { toast('Create failed', 'error'); }
    };
    const deleteOrg = async (o) => {
      if (!confirm(`Delete workspace "${o.name}"?`)) return;
      try { await API.orgs.delete(o.id); toast('Workspace deleted', 'success'); await load(); }
      catch { toast('Delete failed', 'error'); }
    };
    const renameOrg = async (o) => {
      const name = prompt('Rename workspace:', o.name);
      if (!name || name === o.name) return;
      try { await API.orgs.update(o.id, name); toast('Workspace renamed', 'success'); await load(); }
      catch { toast('Rename failed', 'error'); }
    };

    const addUser = async (orgId) => {
      if (!newUserEmail.value) { toast('Select a user to add', 'error'); return; }
      try {
        await API.orgs.addUser(orgId, newUserEmail.value, newUserRights.value);
        newUserEmail.value = ''; newUserRights.value = []; showAddUser.value = null;
        toast('Member added', 'success'); await load();
      } catch (e) { toast(e.error || 'Add failed', 'error'); }
    };
    // Users available to add to a given org (existing users not already in it)
    const availableUsersFor = (org) => {
      const inOrg = new Set((org.users || []).map(u => u.email));
      return allUsers.value.filter(u => !inOrg.has(u.email));
    };
    const removeUser = async (org, email) => {
      if (!confirm(`Remove ${email} from ${org.name}?`)) return;
      try { await API.orgs.removeUser(org.id, email); toast('Member removed', 'success'); await load(); }
      catch { toast('Remove failed', 'error'); }
    };

    // Standalone user CRUD
    const createUser = async () => {
      if (!newUEmail.value.trim() || !newUPassword.value || newUPassword.value.length < 3) {
        toast('Email and password (min 3 chars) required', 'error'); return;
      }
      creatingUser.value = true;
      try {
        await API.users.create(newUEmail.value.trim(), newUPassword.value);
        newUEmail.value = ''; newUPassword.value = '';
        toast('User created', 'success'); await load();
      } catch (e) { toast(e.error || 'Create failed', 'error'); }
      finally { creatingUser.value = false; }
    };
    const deleteUser = async (email) => {
      if (!confirm(`Delete user ${email}? This removes their account entirely.`)) return;
      try { await API.users.delete(email); toast('User deleted', 'success'); await load(); }
      catch { toast('Delete failed', 'error'); }
    };
    const editUser = async (u) => {
      const email = prompt('New email:', u.email);
      if (!email || email === u.email) return;
      const password = prompt('New password (leave blank to keep):', '');
      const body = { newEmail: email };
      if (password) body.password = password;
      try { await API.users.update(u.email, body); toast('User updated', 'success'); await load(); }
      catch (e) { toast(e.error || 'Update failed', 'error'); }
    };

    // Rights editor
    const openRightsEditor = (org, u) => {
      editingRights.value = { orgId: org.id, orgName: org.name, email: u.email, rights: [...(u.rights || [])] };
    };
    const toggleRight = (r) => {
      const i = editingRights.value.rights.indexOf(r);
      if (i >= 0) editingRights.value.rights.splice(i, 1); else editingRights.value.rights.push(r);
    };
    const saveRights = async () => {
      try {
        await API.orgs.updateUser(editingRights.value.orgId, editingRights.value.email, editingRights.value.rights);
        toast('Rights updated', 'success'); editingRights.value = null; await load();
      } catch { toast('Update failed', 'error'); }
    };

    onMounted(load);
    return {
      orgList, allUsers, availableRights, loading, newOrgName, showAddUser, newUserEmail, newUserRights,
      createOrg, deleteOrg, renameOrg, addUser, removeUser, availableUsersFor,
      newUEmail, newUPassword, creatingUser, createUser, deleteUser, editUser,
      editingRights, openRightsEditor, toggleRight, saveRights,
      tab,
      emit, fmtDate,
    };
  },
  template: `
    <div class="modal" @click.stop style="max-width:680px">
      <div style="padding:20px 28px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <h2 class="font-serif" style="font-size:20px">Team & workspaces</h2>
        <button class="btn btn-ghost" @click="emit('close')" style="padding:4px 8px"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div v-if="loading" style="padding:40px;text-align:center"><p class="text-muted">Loading…</p></div>
      <div v-else>
        <!-- Tab switcher -->
        <div style="display:flex;border-bottom:1px solid var(--border)">
          <button @click="tab='workspaces'" style="padding:12px 20px;border:none;background:transparent;cursor:pointer;font-size:13px"
            :style="tab==='workspaces'?'border-bottom:2px solid var(--ink);font-weight:600':'color:var(--ink-muted)'">
            <i class="fa-solid fa-building" style="margin-right:6px"></i> Workspaces ({{orgList.length}})
          </button>
          <button @click="tab='users'" style="padding:12px 20px;border:none;background:transparent;cursor:pointer;font-size:13px"
            :style="tab==='users'?'border-bottom:2px solid var(--ink);font-weight:600':'color:var(--ink-muted)'">
            <i class="fa-solid fa-users" style="margin-right:6px"></i> All users ({{allUsers.length}})
          </button>
        </div>

        <!-- Workspaces tab -->
        <div v-if="tab==='workspaces'" style="padding:20px 28px;max-height:55vh;overflow-y:auto">
        <h3 style="font-size:13px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Workspaces</h3>
        <div style="display:flex;gap:8px;margin-bottom:20px">
          <input class="input" v-model="newOrgName" placeholder="New workspace name" @keyup.enter="createOrg">
          <button class="btn btn-primary" @click="createOrg"><i class="fa-solid fa-plus"></i> Create</button>
        </div>
        <div v-if="orgList.length===0" style="padding:24px;text-align:center"><p class="text-muted">No workspaces yet.</p></div>
        <div v-for="o in orgList" :key="o.id" class="card" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div><h4 style="font-size:15px;font-weight:600;margin:0">{{o.name}}</h4><p class="text-faint" style="font-size:11px;margin:2px 0 0">{{o.users?.length||0}} members · created {{fmtDate(o.createdAt)}}</p></div>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost" @click="renameOrg(o)" style="padding:4px 8px" title="Rename"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-ghost" @click="deleteOrg(o)" style="padding:4px 8px;color:var(--pastel-red-fg)"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
          <div v-for="u in o.users" :key="u.email" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid var(--border)">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:13px">{{u.email}}</span>
              <span v-for="r in u.rights" :key="r" class="tag tag-gray" style="font-size:9px">{{r.replace('landings:','')}}</span>
            </div>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost" @click="openRightsEditor(o,u)" style="padding:2px 8px;font-size:11px"><i class="fa-solid fa-key"></i> Rights</button>
              <button class="btn btn-ghost" @click="removeUser(o,u.email)" style="padding:2px 6px;font-size:11px;color:var(--pastel-red-fg)">Remove</button>
            </div>
          </div>
          <button class="btn btn-ghost" @click="showAddUser=showAddUser===o.id?null:o.id" style="margin-top:8px;font-size:12px"><i class="fa-solid fa-user-plus"></i> Add member</button>
          <div v-if="showAddUser===o.id" style="margin-top:12px;padding:12px;background:var(--surface-raised);border-radius:8px">
            <label class="field" style="margin-bottom:8px"><span>Select user to add</span>
              <select class="input" v-model="newUserEmail">
                <option value="" disabled>Choose a user…</option>
                <option v-for="u in availableUsersFor(o)" :key="u.email" :value="u.email">{{u.email}}</option>
              </select></label>
            <p v-if="availableUsersFor(o).length===0" class="text-faint" style="font-size:11px;margin:-4px 0 8px">All existing users are already in this workspace. Create a new user below in "All users" first.</p>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
              <span v-for="r in availableRights" :key="r" @click="newUserRights.includes(r)?newUserRights=newUserRights.filter(x=>x!==r):newUserRights.push(r)"
                class="tag" :class="newUserRights.includes(r)?'tag-blue':'tag-gray'" style="cursor:pointer">{{r.replace('landings:','')}}</span>
            </div>
            <button class="btn btn-primary" @click="addUser(o.id)" :disabled="!newUserEmail" style="font-size:12px">Add member</button>
          </div>
        </div>
        </div>

        <!-- All users tab -->
        <div v-if="tab==='users'" style="padding:20px 28px;max-height:55vh;overflow-y:auto">
        <h3 style="font-size:13px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">All users</h3>
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
          <input class="input" v-model="newUEmail" placeholder="email@example.com" style="flex:1;min-width:180px">
          <input class="input" v-model="newUPassword" type="password" placeholder="password (min 3)" style="flex:1;min-width:120px">
          <button class="btn btn-primary" @click="createUser" :disabled="creatingUser">{{creatingUser?'Creating…':'Create user'}}</button>
        </div>
        <div v-if="allUsers.length===0" style="padding:16px;text-align:center"><p class="text-muted">No users yet.</p></div>
        <div v-else style="display:flex;flex-direction:column;gap:0">
          <div v-for="u in allUsers" :key="u.email" style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid var(--border)">
            <div><span style="font-size:13px">{{u.email}}</span><span v-if="u.isAdmin" class="tag tag-blue" style="margin-left:8px;font-size:9px">Admin</span></div>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost" @click="editUser(u)" style="padding:2px 8px;font-size:11px"><i class="fa-solid fa-pen"></i> Edit</button>
              <button class="btn btn-ghost" @click="deleteUser(u.email)" style="padding:2px 8px;font-size:11px;color:var(--pastel-red-fg)"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
          </div>
        </div>
        </div>
      </div>

      <!-- Rights editor overlay -->
      <div v-if="editingRights" style="padding:20px 28px;border-top:1px solid var(--border);background:var(--surface-raised)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div><h4 style="font-size:14px;font-weight:600;margin:0">Edit rights — {{editingRights.email}}</h4><p class="text-faint" style="font-size:11px;margin:2px 0 0">in {{editingRights.orgName}}</p></div>
          <button class="btn btn-ghost" @click="editingRights=null" style="padding:4px 8px"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
          <span v-for="r in availableRights" :key="r" @click="toggleRight(r)"
            class="tag" :class="editingRights.rights.includes(r)?'tag-blue':'tag-gray'" style="cursor:pointer;padding:6px 14px">{{r.replace('landings:','')}}</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" @click="editingRights.rights=[]" style="font-size:12px">Check none</button>
          <button class="btn btn-ghost" @click="editingRights.rights=[...availableRights]" style="font-size:12px">Check all</button>
          <button class="btn btn-primary" @click="saveRights" style="margin-left:auto">Save rights</button>
        </div>
      </div>
    </div>`,
});
