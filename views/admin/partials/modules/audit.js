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
          };
          return actionLabels[action] || action;
        }
      };
    }

    window.AppModules = window.AppModules || {};
    window.AppModules.audit = auditModule;
  })();
</script>
