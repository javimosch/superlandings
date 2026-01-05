<script>
  (function () {
    function adminConfigService(fetchImpl = fetch) {
      return {
        async load() {
          const res = await fetchImpl('/api/admin-config');
          return res.json();
        },
        async updateDomains(domains) {
          const res = await fetchImpl('/api/admin-config/domains', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domains })
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async publish(sshKey) {
          const res = await fetchImpl('/api/admin-config/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sshKey })
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async unpublish(sshKey) {
          const res = await fetchImpl('/api/admin-config/unpublish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sshKey })
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        }
      };
    }
    window.AppServices = window.AppServices || {};
    window.AppServices.adminConfig = adminConfigService;
  })();
</script>
