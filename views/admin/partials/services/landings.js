<script>
  (function () {
    function landingsService(fetchImpl = fetch) {
      return {
        async list(headers) {
          const res = await fetchImpl('/api/landings', { headers });
          return res.json();
        },
        async create(formData, headers) {
          const res = await fetchImpl('/api/landings', { method: 'POST', body: formData, headers });
          const data = await res.json();
          return { ok: res.ok, data };
        },
        async getContent(id) {
          const res = await fetchImpl(`/api/landings/${id}/content`);
          return res.json();
        },
        async update(id, payload, headers) {
          const isFormData = payload instanceof FormData;
          const res = await fetchImpl(`/api/landings/${id}`, {
            method: 'PUT',
            headers: isFormData ? headers : { 'Content-Type': 'application/json', ...headers },
            body: isFormData ? payload : JSON.stringify(payload)
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async updateFiles(id, formData, headers) {
          const res = await fetchImpl(`/api/landings/${id}`, { 
            method: 'PUT', 
            body: formData,
            headers
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async remove(id, sshKey) {
          const res = await fetchImpl(`/api/landings/${id}`, {
            method: 'DELETE',
            headers: { 'X-SSH-Key': sshKey || '' }
          });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        },
        async clearCache(id) {
          const res = await fetchImpl(`/api/landings/${id}/cache/clear`, { method: 'POST' });
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        }
      };
    }
    window.AppServices = window.AppServices || {};
    window.AppServices.landings = landingsService;
  })();
</script>
