<script>
  (function () {
    function domainsModule(services) {
      const domains = services?.domains ? services.domains() : null;
      const adminConfig = services?.adminConfig ? services.adminConfig() : null;

      return {
        // Domains modal controls
        openDomainsModal(landing) {
          this.editingDomains = { ...landing, domains: landing.domains.map(d => ({ ...d })) };
          this.showDomainsModal = true;
          this.cloudflareDomainInput = '';
          this.cloudflareRecap = { steps: [], info: '' };
          // Keep existing behavior: refresh CF status if available
          if (this.loadCloudflareStatus) this.loadCloudflareStatus();
        },
        closeDomainsModal() {
          this.showDomainsModal = false;
          this.editingDomains = null;
          this.cloudflareDomainInput = '';
          this.cloudflareRecap = { steps: [], info: '' };
        },
        addDomain() { this.editingDomains.domains.push({ domain: '', published: false }); },
        removeDomain(index) { this.editingDomains.domains.splice(index, 1); },

    async publishSingleDomain(domain) {
      const loadingKey = this.editingDomains.id + '-' + domain;
      this.loading[loadingKey] = true;
      try {
        if (!domains) throw new Error('Domains service missing');
        const sshKey = this.getSetting('traefik_ssh_private_key');
        const { ok, data } = await domains.publishDomain(this.editingDomains.id, domain, sshKey);
        if (!ok) throw new Error(data.error || 'Failed to publish domain');
        this.showSuccess(data.message);
        await this.loadLandings();
        const domainObj = this.editingDomains.domains.find(d => d.domain === domain);
        if (domainObj) domainObj.published = true;
      } catch (err) {
        this.showError('Error publishing domain: ' + err.message);
      } finally {
        this.loading[loadingKey] = false;
      }
    },

    async unpublishSingleDomain(domain) {
      const loadingKey = this.editingDomains.id + '-' + domain;
      this.loading[loadingKey] = true;
      try {
        if (!domains) throw new Error('Domains service missing');
        const sshKey = this.getSetting('traefik_ssh_private_key');
        const { ok, data } = await domains.unpublishDomain(this.editingDomains.id, domain, sshKey);
        if (!ok) throw new Error(data.error || 'Failed to unpublish domain');
        this.showSuccess(data.message);
        await this.loadLandings();
        const domainObj = this.editingDomains.domains.find(d => d.domain === domain);
        if (domainObj) domainObj.published = false;
      } catch (err) {
        this.showError('Error unpublishing domain: ' + err.message);
      } finally {
        this.loading[loadingKey] = false;
      }
    },

        async saveDomains() {
          try {
            if (!domains) throw new Error('Domains service missing');
            const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            const cleanDomains = this.editingDomains.domains
              .filter(d => d.domain?.trim())
              .map(d => ({ domain: d.domain.trim(), published: d.published || false }));
            const invalidDomains = cleanDomains.filter(d => !domainPattern.test(d.domain));
            if (invalidDomains.length > 0) {
              this.showError('Invalid domain format: ' + invalidDomains.map(d => d.domain).join(', '));
              return;
            }
            const { ok, data } = await domains.updateDomains(this.editingDomains.id, cleanDomains);
            if (!ok) throw new Error(data.error || 'Failed to update domains');
            this.showSuccess('Domains updated successfully!');
            this.closeDomainsModal();
            this.loadLandings();
          } catch (err) {
            this.showError('Error updating domains: ' + err.message);
          }
        },

        async publishLanding(id) {
          this.loading[id] = true;
          try {
            if (!domains) throw new Error('Domains service missing');
            const sshKey = this.getSetting('traefik_ssh_private_key');
            const { ok, data } = await domains.publishLanding(id, sshKey);
            if (!ok) throw new Error(data.error || 'Failed to publish');
            this.showSuccess(data.message);
            this.loadLandings();
          } catch (err) {
            this.showError('Error publishing: ' + err.message);
          } finally {
            this.loading[id] = false;
          }
        },

        async unpublishLanding(id) {
          this.loading[id] = true;
          try {
            if (!domains) throw new Error('Domains service missing');
            const sshKey = this.getSetting('traefik_ssh_private_key');
            const { ok, data } = await domains.unpublishLanding(id, sshKey);
            if (!ok) throw new Error(data.error || 'Failed to unpublish');
            this.showSuccess(data.message);
            this.loadLandings();
          } catch (err) {
            this.showError('Error unpublishing: ' + err.message);
          } finally {
            this.loading[id] = false;
          }
        },

        // Admin domains
        async saveAdminDomains() {
          try {
            if (!adminConfig) throw new Error('AdminConfig service missing');
            const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            const cleanDomains = this.adminConfig.domains
              .filter(d => d.domain?.trim())
              .map(d => ({ domain: d.domain.trim(), published: d.published || false }));
            const invalidDomains = cleanDomains.filter(d => !domainPattern.test(d.domain));
            if (invalidDomains.length > 0) {
              this.showError('Invalid domain format: ' + invalidDomains.map(d => d.domain).join(', '));
              return;
            }
            const { ok, data } = await adminConfig.updateDomains(cleanDomains);
            if (!ok) throw new Error(data.error || 'Failed to update admin domains');
            this.showSuccess('Admin domains updated successfully!');
            this.loadAdminConfig();
          } catch (err) {
            this.showError('Error updating admin domains: ' + err.message);
          }
        },

        async publishAdmin() {
          this.loading.admin = true;
          try {
            if (!adminConfig) throw new Error('AdminConfig service missing');
            const sshKey = this.getSetting('traefik_ssh_private_key');
            const { ok, data } = await adminConfig.publish(sshKey);
            if (!ok) throw new Error(data.error || 'Failed to publish admin');
            this.showSuccess(data.message);
            this.loadAdminConfig();
          } catch (err) {
            this.showError('Error publishing admin: ' + err.message);
          } finally {
            this.loading.admin = false;
          }
        },

        async unpublishAdmin() {
          this.loading.admin = true;
          try {
            if (!adminConfig) throw new Error('AdminConfig service missing');
            const sshKey = this.getSetting('traefik_ssh_private_key');
            const { ok, data } = await adminConfig.unpublish(sshKey);
            if (!ok) throw new Error(data.error || 'Failed to unpublish admin');
            this.showSuccess(data.message);
            this.loadAdminConfig();
          } catch (err) {
            this.showError('Error unpublishing admin: ' + err.message);
          } finally {
            this.loading.admin = false;
          }
        },
      };
    }

    window.AppModules = window.AppModules || {};
    window.AppModules.domains = domainsModule;
  })();
</script>
