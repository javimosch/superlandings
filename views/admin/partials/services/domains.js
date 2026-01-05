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
        async publishDomain(landingId, domain, sshKey) {
          const res = await fetchImpl(`/api/landings/${landingId}/domains/${encodeURIComponent(domain)}/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sshKey })
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async unpublishDomain(landingId, domain, sshKey) {
          const res = await fetchImpl(`/api/landings/${landingId}/domains/${encodeURIComponent(domain)}/unpublish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sshKey })
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async publishLanding(id, sshKey) {
          const res = await fetchImpl(`/api/landings/${id}/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sshKey })
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async unpublishLanding(id, sshKey) {
          const res = await fetchImpl(`/api/landings/${id}/unpublish`, {
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
    window.AppServices.domains = domainsService;
  })();
</script>
