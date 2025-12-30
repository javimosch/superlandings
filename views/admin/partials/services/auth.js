<script>
  (function () {
    function authService(fetchImpl = fetch) {
      return {
        async loadAuthInfo(headers) {
          const res = await fetchImpl('/api/auth/me', { headers });
          return res.json();
        }
      };
    }
    window.AppServices = window.AppServices || {};
    window.AppServices.auth = authService;
  })();
</script>
