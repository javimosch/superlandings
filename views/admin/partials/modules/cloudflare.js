<script>
  (function () {
    function cloudflareModule(services, helpers) {
      const cf = services?.cloudflare ? services.cloudflare() : null;

      return {
        async loadCloudflareStatus() {
          try {
            if (!cf) throw new Error('Cloudflare service missing');
            const { ok, data } = await cf.status(this.getHeaders());
            if (!ok) throw new Error(data.error || 'Failed to load Cloudflare status');
            this.cloudflareStatus = data;
          } catch (err) {
            this.cloudflareStatus = { enabled: false, connected: false, connectedAt: null, email: null };
          }
        },

        async connectCloudflare() {
          this.loading.cloudflareConnect = true;
          try {
            if (!cf) throw new Error('Cloudflare service missing');
            const { ok, data } = await cf.connect(this.getHeaders());
            if (!ok) throw new Error(data.error || 'Failed to connect Cloudflare');
            this.showSuccess('Cloudflare connected');
            await this.loadCloudflareStatus();
          } catch (err) {
            this.showError('Error connecting Cloudflare: ' + err.message);
          } finally {
            this.loading.cloudflareConnect = false;
          }
        },

        async disconnectCloudflare() {
          this.loading.cloudflareDisconnect = true;
          try {
            if (!cf) throw new Error('Cloudflare service missing');
            const { ok, data } = await cf.disconnect(this.getHeaders());
            if (!ok) throw new Error(data.error || 'Failed to disconnect Cloudflare');
            this.showSuccess('Cloudflare disconnected');
            await this.loadCloudflareStatus();
          } catch (err) {
            this.showError('Error disconnecting Cloudflare: ' + err.message);
          } finally {
            this.loading.cloudflareDisconnect = false;
          }
        },

        async configureCloudflareDns() {
          this.loading.cloudflareConfigure = true;
          this.cloudflareRecap = { steps: [], info: '' };
          try {
            if (!cf) throw new Error('Cloudflare service missing');
            const domain = this.cloudflareDomainInput.trim();
            const { ok, data } = await cf.configureDns(domain, this.getHeaders());
            if (!ok) throw new Error(data.error || 'Failed to configure DNS');
            this.cloudflareRecap = { steps: data.steps || [], info: data.info || '' };
            this.showSuccess('Cloudflare DNS configured');
          } catch (err) {
            this.showError('Error configuring Cloudflare DNS: ' + err.message);
          } finally {
            this.loading.cloudflareConfigure = false;
          }
        }
      };
    }

    window.AppModules = window.AppModules || {};
    window.AppModules.cloudflare = cloudflareModule;
  })();
</script>
