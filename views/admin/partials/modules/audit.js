<script>
  (function () {
    function auditModule(services) {
      const audit = services?.audit ? services.audit() : null;

      return {
        async openAuditModal(landing) {
          this.auditLanding = landing;
          this.auditEntries = [];
          this.auditTotal = 0;
          this.auditHasMore = false;
          this.auditOffset = 0;
          this.showAuditModal = true;
          await this.loadAuditLog();
        },

        closeAuditModal() {
          this.showAuditModal = false;
          this.auditLanding = null;
          this.auditEntries = [];
          this.auditTotal = 0;
          this.auditHasMore = false;
          this.auditOffset = 0;
        },

        async loadAuditLog() {
          if (!this.auditLanding) return;
          this.loading.audit = true;
          try {
            if (!audit) throw new Error('Audit service missing');
            const { ok, data } = await audit.list(this.auditLanding.id, { limit: 50, offset: this.auditOffset });
            if (!ok) throw new Error(data.error || 'Failed to load audit log');
            this.auditEntries = data.entries;
            this.auditTotal = data.total;
            this.auditHasMore = data.hasMore;
          } catch (err) {
            this.showError('Error loading audit log: ' + err.message);
          } finally {
            this.loading.audit = false;
          }
        },

        async loadMoreAudit() {
          if (!this.auditLanding || !this.auditHasMore) return;
          this.loading.auditMore = true;
          try {
            this.auditOffset += 50;
            if (!audit) throw new Error('Audit service missing');
            const { ok, data } = await audit.list(this.auditLanding.id, { limit: 50, offset: this.auditOffset });
            if (!ok) throw new Error(data.error || 'Failed to load more audit entries');
            this.auditEntries = [...this.auditEntries, ...data.entries];
            this.auditHasMore = data.hasMore;
          } catch (err) {
            this.showError('Error loading more audit entries: ' + err.message);
          } finally {
            this.loading.auditMore = false;
          }
        },

        formatAuditDate(dateStr) {
          if (!dateStr) return '';
          return new Date(dateStr).toLocaleString();
        },

        formatAuditAction(action) {
          const actionLabels = {
            'create': 'Created',
            'update': 'Updated',
            'delete': 'Deleted',
            'publish': 'Published',
            'unpublish': 'Unpublished',
            'rollback': 'Rollback',
            'version_create': 'Snapshot',
            'version_delete': 'Version Deleted',
            'version_tag': 'Tagged',
            'version_untag': 'Untagged',
            'domain_add': 'Domain Added',
            'domain_remove': 'Domain Removed',
            'domain_publish': 'Domain Published',
            'domain_unpublish': 'Domain Unpublished',
            'move': 'Moved',
            'cloudflare_connect': 'Cloudflare Connected',
            'cloudflare_disconnect': 'Cloudflare Disconnected',
            'cloudflare_dns_configure': 'Cloudflare DNS Configured'
          };
          return actionLabels[action] || action;
        },

        getAuditActionClass(action) {
          const base = 'px-2 py-0.5 rounded text-xs font-bold uppercase';
          const actionClasses = {
            'create': 'bg-green-100 text-green-700',
            'update': 'bg-blue-100 text-blue-700',
            'delete': 'bg-red-100 text-red-700',
            'publish': 'bg-emerald-100 text-emerald-700',
            'unpublish': 'bg-amber-100 text-amber-700',
            'rollback': 'bg-purple-100 text-purple-700',
            'version_create': 'bg-indigo-100 text-indigo-700',
            'version_delete': 'bg-rose-100 text-rose-700',
            'version_tag': 'bg-cyan-100 text-cyan-700',
            'version_untag': 'bg-slate-100 text-slate-700',
            'domain_add': 'bg-teal-100 text-teal-700',
            'domain_remove': 'bg-orange-100 text-orange-700',
            'domain_publish': 'bg-lime-100 text-lime-700',
            'domain_unpublish': 'bg-yellow-100 text-yellow-700',
            'move': 'bg-gray-100 text-gray-700',
            'cloudflare_connect': 'bg-sky-100 text-sky-700',
            'cloudflare_disconnect': 'bg-sky-100 text-sky-700',
            'cloudflare_dns_configure': 'bg-sky-100 text-sky-700'
          };
          return `${base} ${actionClasses[action] || 'bg-gray-100 text-gray-700'}`;
        }
      };
    }

    window.AppModules = window.AppModules || {};
    window.AppModules.audit = auditModule;
  })();
</script>
