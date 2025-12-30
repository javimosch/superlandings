<script>
  (function () {
    function organizationsService(fetchImpl = fetch) {
      return {
        async list() {
          const res = await fetchImpl('/api/organizations');
          return res.json();
        },
        async create(name) {
          const res = await fetchImpl('/api/organizations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async update(id, name) {
          const res = await fetchImpl(`/api/organizations/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async remove(id) {
          const res = await fetchImpl(`/api/organizations/${id}`, { method: 'DELETE' });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async addUser(orgId, email) {
          const res = await fetchImpl(`/api/organizations/${orgId}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, rights: [] })
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async removeUser(orgId, email) {
          const res = await fetchImpl(`/api/organizations/${orgId}/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async saveUserRights(orgId, email, rights) {
          const res = await fetchImpl(`/api/organizations/${orgId}/users/${encodeURIComponent(email)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rights })
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async moveLanding(landingId, targetOrganizationId) {
          const res = await fetchImpl('/api/migration/move-landing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ landingId, targetOrganizationId })
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        }
      };
    }
    window.AppServices = window.AppServices || {};
    window.AppServices.organizations = organizationsService;
  })();
</script>
