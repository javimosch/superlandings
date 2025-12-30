<script>
  (function () {
    function domainsService(fetchImpl = fetch) {
      return {
        async updateDomains(landingId, domains) {
          const res = await fetchImpl(`/api/landings/${landingId}/domains`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domains })
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async publishDomain(landingId, domain) {
          const res = await fetchImpl(`/api/landings/${landingId}/domains/${encodeURIComponent(domain)}/publish`, { method: 'POST' });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async unpublishDomain(landingId, domain) {
          const res = await fetchImpl(`/api/landings/${landingId}/domains/${encodeURIComponent(domain)}/unpublish`, { method: 'POST' });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async publishLanding(landingId) {
          const res = await fetchImpl(`/api/landings/${landingId}/publish`, { method: 'POST' });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async unpublishLanding(landingId) {
          const res = await fetchImpl(`/api/landings/${landingId}/unpublish`, { method: 'POST' });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        }
      };
    }
    window.AppServices = window.AppServices || {};
    window.AppServices.domains = domainsService;
  })();
</script>
