<script>
  (function () {
    function landingsModule(services, helpers) {
      const landings = services?.landings ? services.landings() : null;

      return {
        async loadLandings() {
          try {
            if (!landings) throw new Error('Landings service missing');
            const data = await landings.list(this.getHeaders());
            this.landings = data;
          } catch (err) {
            this.showError('Error loading landings: ' + err.message);
          }
        },

        closeAddModal() {
          this.showAddModal = false;
          this.newLanding = {
            name: '',
            slug: '',
            type: 'html',
            domains: [],
            content: '<!DOCTYPE html>\\n<html>\\n<head>\\n  <title>New Landing</title>\\n</head>\\n<body>\\n  <h1>Hello World!</h1>\\n</body>\\n</html>'
          };
          this.selectedEjsFiles = [];
          this.selectedEjsZip = null;
          if (this.addEditor) {
            this.addEditor.toTextArea();
            this.addEditor = null;
          }
        },

        async addLanding() {
          try {
            if (!landings) throw new Error('Landings service missing');
            const formData = new FormData();
            formData.append('name', this.newLanding.name);
            formData.append('slug', this.newLanding.slug);
            formData.append('type', this.newLanding.type);
            if (this.currentOrganization) {
              formData.append('organizationId', this.currentOrganization.id);
            }
            const domains = this.newLanding.domains
              .filter(d => (typeof d === 'string' ? d.trim() : d.domain && d.domain.trim()))
              .map(d => (typeof d === 'string' ? { domain: d.trim(), published: false } : d));
            formData.append('domains', JSON.stringify(domains));

            if (this.newLanding.type === 'html') {
              formData.append('content', this.addEditor ? this.addEditor.getValue() : this.newLanding.content);
            } else if (this.newLanding.type === 'ejs') {
              if (this.selectedEjsZip) {
                formData.append('files', this.selectedEjsZip);
              } else if (this.selectedEjsFiles.length > 0) {
                this.selectedEjsFiles.forEach(file => formData.append('files', file));
              }
            } else if (this.$refs.fileInput?.files.length > 0) {
              Array.from(this.$refs.fileInput.files).forEach(file => formData.append('files', file));
            }

            const { ok, data } = await landings.create(formData, this.getHeaders());
            if (!ok) throw new Error(data.error || 'Failed to create landing');

            this.showSuccess('Landing created successfully!');
            this.closeAddModal();
            this.loadLandings();
          } catch (err) {
            this.showError('Error creating landing: ' + err.message);
          }
        },

        async editLanding(landing) {
          try {
            if (!landings) throw new Error('Landings service missing');
            if (landing.type === 'html') {
              const data = await landings.getContent(landing.id);
              this.editingLanding = { ...landing, content: data.content };
            } else {
              this.editingLanding = { ...landing };
            }
            this.showEditModal = true;
            this.$nextTick(() => { if (landing.type === 'html') this.initEditEditor(); });
          } catch (err) {
            this.showError('Error loading landing: ' + err.message);
          }
        },

        async saveEdit() {
          try {
            if (!landings) throw new Error('Landings service missing');
            if (this.editingLanding.type === 'html') {
              const content = this.editEditor.getValue();
              const { ok, data } = await landings.update(this.editingLanding.id, { content }, this.getHeaders());
              if (!ok) throw new Error(data.error || 'Failed to save');
            } else if (this.editingLanding.type === 'ejs') {
              const formData = new FormData();
              if (this.editSelectedEjsZip) {
                formData.append('files', this.editSelectedEjsZip);
              } else if (this.editSelectedEjsFiles.length > 0) {
                this.editSelectedEjsFiles.forEach(file => formData.append('files', file));
              } else {
                this.showError('Please select EJS files or a ZIP file to update');
                return;
              }
              const { ok, data } = await landings.updateFiles(this.editingLanding.id, formData);
              if (!ok) throw new Error(data.error || 'Failed to save');
            }
            this.showSuccess('Changes saved successfully!');
            this.closeEditModal();
            this.loadLandings();
          } catch (err) {
            this.showError('Error saving: ' + err.message);
          }
        },

        closeEditModal() {
          this.showEditModal = false;
          this.editingLanding = null;
          this.editSelectedEjsFiles = [];
          this.editSelectedEjsZip = null;
          if (this.editEditor) { this.editEditor.toTextArea(); this.editEditor = null; }
        },

        async deleteLanding(id) {
          try {
            if (!landings) throw new Error('Landings service missing');
            const sshKey = this.getSetting('traefik_ssh_private_key');
            const { ok, data } = await landings.remove(id, sshKey);
            if (!ok) throw new Error(data.error || 'Failed to delete');
            this.showSuccess('Landing deleted successfully!');
            this.loadLandings();
          } catch (err) {
            this.showError('Error deleting landing: ' + err.message);
          }
        },

        async clearLandingCache(landing) {
          const loadingKey = `cache-${landing.id}`;
          if (!this.isMounted) return;
          this.loading = { ...this.loading, [loadingKey]: true };
          try {
            if (!landings) throw new Error('Landings service missing');
            const { ok, data } = await landings.clearCache(landing.id);
            if (!ok) throw new Error(data.error || 'Failed to clear cache');
            const msg = data.cleared ? 'Cache cleared from disk' : 'Cache already clean';
            this.showSuccess(msg);
          } catch (err) {
            this.showError('Error clearing cache: ' + err.message);
          } finally {
            this.loading = { ...this.loading, [loadingKey]: false };
          }
        },

        // File handling
        handleEjsFilesChange(event) {
          this.selectedEjsFiles = Array.from(event.target.files);
          this.selectedEjsZip = null;
          if (this.$refs.ejsZipInput) this.$refs.ejsZipInput.value = '';
        },
        handleEjsZipChange(event) {
          this.selectedEjsZip = event.target.files[0] || null;
          this.selectedEjsFiles = [];
          if (this.$refs.ejsFileInput) this.$refs.ejsFileInput.value = '';
        },
        handleEditEjsFilesChange(event) {
          this.editSelectedEjsFiles = Array.from(event.target.files);
          this.editSelectedEjsZip = null;
          if (this.$refs.editEjsZipInput) this.$refs.editEjsZipInput.value = '';
        },
        handleEditEjsZipChange(event) {
          this.editSelectedEjsZip = event.target.files[0] || null;
          this.editSelectedEjsFiles = [];
          if (this.$refs.editEjsFileInput) this.$refs.editEjsFileInput.value = '';
        }
      };
    }

    window.AppModules = window.AppModules || {};
    window.AppModules.landings = landingsModule;
  })();
</script>
