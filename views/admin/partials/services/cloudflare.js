<script>
  (function () {
    function cloudflareService(fetchImpl = fetch) {
      return {
        async status(headers) {
          const res = await fetchImpl('/api/cloudflare/status', { headers });
          const data = await res.json();
          return { ok: res.ok, data };
        },
        async connect(headers) {
          const res = await fetchImpl('/api/cloudflare/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({})
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async disconnect(headers) {
          const res = await fetchImpl('/api/cloudflare/disconnect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({})
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async configureDns(domain, headers) {
          const res = await fetchImpl('/api/cloudflare/dns/configure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ domain })
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        }
      };
    }
    window.AppServices = window.AppServices || {};
    window.AppServices.cloudflare = cloudflareService;
  })();
</script>
