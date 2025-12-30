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
        async publish() {
          const res = await fetchImpl('/api/admin-config/publish', { method: 'POST' });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async unpublish() {
          const res = await fetchImpl('/api/admin-config/unpublish', { method: 'POST' });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        }
      };
    }
    window.AppServices = window.AppServices || {};
    window.AppServices.adminConfig = adminConfigService;
  })();
</script>
