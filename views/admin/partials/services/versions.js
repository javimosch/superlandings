<script>
  (function () {
    function versionsService(fetchImpl = fetch) {
      return {
        async list(landingId) {
          const res = await fetchImpl(`/api/landings/${landingId}/versions`);
          const data = await res.json();
          return { ok: res.ok, data };
        },
        async create(landingId, description) {
          const res = await fetchImpl(`/api/landings/${landingId}/versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description })
          });
          const data = await res.json();
          return { ok: res.ok, data };
        },
        async preview(landingId, versionId) {
          const res = await fetchImpl(`/api/landings/${landingId}/versions/${versionId}/preview`);
          const data = await res.json();
          return { ok: res.ok, data };
        },
        async diff(landingId, versionId) {
          const res = await fetchImpl(`/api/landings/${landingId}/versions/${versionId}/diff`);
          const data = await res.json();
          return { ok: res.ok, data };
        },
        async rollback(landingId, versionId) {
          const res = await fetchImpl(`/api/landings/${landingId}/versions/${versionId}/rollback`, { method: 'POST' });
          const data = await res.json();
          return { ok: res.ok, data };
        },
        async remove(landingId, versionId) {
          const res = await fetchImpl(`/api/landings/${landingId}/versions/${versionId}`, { method: 'DELETE' });
          const data = await res.json();
          return { ok: res.ok, data };
        },
        async updateDescription(landingId, versionId, description) {
          const res = await fetchImpl(`/api/landings/${landingId}/versions/${versionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description })
          });
          const data = await res.json();
          return { ok: res.ok, data };
        },
        async updateTag(landingId, versionId, tag) {
          const res = await fetchImpl(`/api/landings/${landingId}/versions/${versionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag })
          });
          const data = await res.json();
          return { ok: res.ok, data };
        }
      };
    }
    window.AppServices = window.AppServices || {};
    window.AppServices.versions = versionsService;
  })();
</script>
