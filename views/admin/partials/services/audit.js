<script>
  (function () {
    function auditService(fetchImpl = fetch) {
      return {
        async list(landingId, { limit = 50, offset = 0 } = {}) {
          const res = await fetchImpl(`/api/landings/${landingId}/audit?limit=${limit}&offset=${offset}`);
          const data = await res.json();
          return { ok: res.ok, data };
        }
      };
    }
    window.AppServices = window.AppServices || {};
    window.AppServices.audit = auditService;
  })();
</script>
