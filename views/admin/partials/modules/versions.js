<script>
  (function () {
    function versionsModule(services) {
      const versions = services?.versions ? services.versions() : null;

      return {
        // Versions
        async openVersionsModal(landing) {
          this.versionLanding = landing;
          this.versions = [];
          this.newVersionDescription = '';
          this.showVersionsModal = true;
          await this.loadVersions();
        },

        closeVersionsModal() {
          this.showVersionsModal = false;
          this.versionLanding = null;
          this.versions = [];
        },

        async loadVersions() {
          if (!this.versionLanding) return;
          this.loading.versions = true;
          try {
            if (!versions) throw new Error('Versions service missing');
            const { ok, data } = await versions.list(this.versionLanding.id);
            if (!ok) throw new Error(data.error || 'Failed to load versions');
            this.versions = data;
          } catch (err) {
            this.showError('Error loading versions: ' + err.message);
            this.versions = [];
          } finally {
            this.loading.versions = false;
          }
        },

        async createSnapshot() {
          this.loading.createVersion = true;
          try {
            if (!versions) throw new Error('Versions service missing');
            const { ok, data } = await versions.create(
              this.versionLanding.id,
              this.newVersionDescription || 'Manual snapshot'
            );
            if (!ok) throw new Error(data.error || 'Failed to create snapshot');
            this.showSuccess('Snapshot created!');
            this.newVersionDescription = '';
            await this.loadVersions();
          } catch (err) {
            this.showError('Error creating snapshot: ' + err.message);
          } finally {
            this.loading.createVersion = false;
          }
        },

        async previewVersion(version) {
          try {
            if (!versions) throw new Error('Versions service missing');
            const { ok, data } = await versions.preview(this.versionLanding.id, version.id);
            if (!ok) throw new Error(data.error || 'Failed to load preview');
            this.previewingVersion = version;
            this.versionPreviewContent = data.content;
            this.showVersionPreviewModal = true;
          } catch (err) {
            this.showError('Error loading preview: ' + err.message);
          }
        },

        async viewVersionHtml(version) {
          const loadingKey = 'html-' + version.id;
          this.loading[loadingKey] = true;
          try {
            if (!versions) throw new Error('Versions service missing');
            const { ok, data } = await versions.preview(this.versionLanding.id, version.id);
            if (!ok) throw new Error(data.error || 'Failed to load HTML');
            this.viewingHtmlVersion = version;
            this.versionHtmlContent = data.content;
            this.showVersionHtmlModal = true;
          } catch (err) {
            this.showError('Error loading HTML: ' + err.message);
          } finally {
            this.loading[loadingKey] = false;
          }
        },

        async copyVersionHtml() {
          try {
            await navigator.clipboard.writeText(this.versionHtmlContent);
            this.showSuccess('HTML copied to clipboard!');
          } catch (err) {
            this.showError('Failed to copy: ' + err.message);
          }
        },

        async rollbackToVersion(version) {
          this.confirmingVersion = version;
          this.showRollbackConfirm = true;
        },

        async confirmRollback() {
          if (!this.confirmingVersion) return;
          const loadingKey = 'rollback-' + this.confirmingVersion.id;
          this.loading[loadingKey] = true;
          this.showRollbackConfirm = false;
          try {
            if (!versions) throw new Error('Versions service missing');
            const { ok, data } = await versions.rollback(this.versionLanding.id, this.confirmingVersion.id);
            if (!ok) throw new Error(data.error || 'Failed to rollback');
            this.showSuccess(data.message);
            await this.loadVersions();
            await this.loadLandings();
          } catch (err) {
            this.showError('Error rolling back: ' + err.message);
          } finally {
            this.loading[loadingKey] = false;
            this.confirmingVersion = null;
          }
        },

        async deleteVersionItem(version) {
          if (this.versions.length <= 1) {
            this.showError('Cannot delete the last version. A landing page must have at least one version.');
            return;
          }
          this.confirmingVersion = version;
          this.showDeleteConfirm = true;
        },

        async confirmDelete() {
          if (!this.confirmingVersion) return;
          if (this.versions.length <= 1) {
            this.showError('Cannot delete the last version. A landing page must have at least one version.');
            this.showDeleteConfirm = false;
            this.confirmingVersion = null;
            return;
          }
          const loadingKey = 'delete-' + this.confirmingVersion.id;
          this.loading[loadingKey] = true;
          this.showDeleteConfirm = false;
          try {
            if (!versions) throw new Error('Versions service missing');
            const { ok, data } = await versions.remove(this.versionLanding.id, this.confirmingVersion.id);
            if (!ok) throw new Error(data.error || 'Failed to delete version');
            this.showSuccess('Version deleted!');
            await this.loadVersions();
          } catch (err) {
            this.showError('Error deleting version: ' + err.message);
          } finally {
            this.loading[loadingKey] = false;
            this.confirmingVersion = null;
          }
        },

        formatVersionDate(dateStr) {
          if (!dateStr) return '';
          return new Date(dateStr).toLocaleString();
        },

        formatBytes(bytes) {
          if (!bytes) return '0 B';
          const k = 1024;
          const sizes = ['B', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        },

        // Version editing
        startEditDescription(version) {
          this.editingVersionId = version.id;
          this.tempDescription = version.description || '';
          this.editingVersionDescription = true;
          this.$nextTick(() => {
            const input = this.$refs[`desc-input-${version.id}`]?.[0];
            if (input) input.focus();
          });
        },

        async saveDescription() {
          if (!this.editingVersionId) return;
          try {
            if (!versions) throw new Error('Versions service missing');
            const { ok, data } = await versions.updateDescription(
              this.versionLanding.id,
              this.editingVersionId,
              this.tempDescription
            );
            if (!ok) throw new Error(data.error || 'Failed to update description');
            this.showSuccess('Description updated!');
            await this.loadVersions();
            this.cancelEditDescription();
          } catch (err) {
            this.showError('Error updating description: ' + err.message);
          }
        },

        cancelEditDescription() {
          this.editingVersionDescription = false;
          this.editingVersionId = null;
          this.tempDescription = '';
        },

        startEditTag(version) {
          this.editingVersionId = version.id;
          this.tempTag = version.tag || '';
          this.editingVersionTag = true;
          this.$nextTick(() => {
            const input = this.$refs[`tag-input-${version.id}`]?.[0];
            if (input) input.focus();
          });
        },

        async saveTag() {
          if (!this.editingVersionId) return;
          try {
            if (!versions) throw new Error('Versions service missing');
            const { ok, data } = await versions.updateTag(
              this.versionLanding.id,
              this.editingVersionId,
              this.tempTag.trim() || null
            );
            if (!ok) throw new Error(data.error || 'Failed to update tag');
            this.showSuccess('Tag updated!');
            await this.loadVersions();
            this.cancelEditTag();
          } catch (err) {
            this.showError('Error updating tag: ' + err.message);
          }
        },

        cancelEditTag() {
          this.editingVersionTag = false;
          this.editingVersionId = null;
          this.tempTag = '';
        },

        removeTag(version) {
          this.editingVersionId = version.id;
          this.tempTag = null;
          this.saveTag();
        },

        // Diff
        async openDiffModal(version) {
          const loadingKey = 'diff-' + version.id;
          this.loading[loadingKey] = true;
          this.loading.diff = true;
          try {
            if (!versions) throw new Error('Versions service missing');
            const { ok, data } = await versions.diff(this.versionLanding.id, version.id);
            if (!ok) throw new Error(data.error || 'Failed to load diff');
            this.diffData = data;
            this.collapsedFiles = {};
            if (data.diffs) {
              data.diffs.forEach((diff, idx) => {
                const totalChanges = this.countChangesNum(diff);
                if (totalChanges > 50) {
                  this.collapsedFiles[idx] = true;
                }
              });
            }
            this.showDiffModal = true;
          } catch (err) {
            this.showError('Error loading diff: ' + err.message);
          } finally {
            this.loading[loadingKey] = false;
            this.loading.diff = false;
          }
        },

        closeDiffModal() {
          this.showDiffModal = false;
          this.diffData = null;
          this.collapsedFiles = {};
        },

        toggleFileDiff(fileIdx) {
          this.collapsedFiles[fileIdx] = !this.collapsedFiles[fileIdx];
        },

        toggleAllFiles() {
          const allCollapsed = this.allFilesCollapsed;
          if (this.diffData?.diffs) {
            this.diffData.diffs.forEach((_, idx) => {
              this.collapsedFiles[idx] = !allCollapsed;
            });
          }
        },

        countChanges(fileDiff) {
          if (fileDiff.type === 'added') {
            const lines = fileDiff.hunks.reduce((sum, h) => sum + (h.newLines?.length || 0), 0);
            return `+${lines} lines`;
          }
          if (fileDiff.type === 'deleted') {
            const lines = fileDiff.hunks.reduce((sum, h) => sum + (h.oldLines?.length || 0), 0);
            return `-${lines} lines`;
          }
          let added = 0, removed = 0;
          fileDiff.hunks.forEach(h => {
            h.changes?.forEach(c => {
              if (c.type === 'add') added++;
              if (c.type === 'remove') removed++;
            });
          });
          return `+${added} -${removed}`;
        },

        countChangesNum(fileDiff) {
          if (fileDiff.type === 'added') {
            return fileDiff.hunks.reduce((sum, h) => sum + (h.newLines?.length || 0), 0);
          }
          if (fileDiff.type === 'deleted') {
            return fileDiff.hunks.reduce((sum, h) => sum + (h.oldLines?.length || 0), 0);
          }
          let total = 0;
          fileDiff.hunks.forEach(h => {
            h.changes?.forEach(c => {
              if (c.type === 'add' || c.type === 'remove') total++;
            });
          });
          return total;
        },

        getVersionNumber(versionId) {
          if (!this.versions || !versionId) return '?';
          const version = this.versions.find(v => v.id === versionId);
          return version ? version.versionNumber : '?';
        },

        async viewLinkedVersion(versionId) {
          if (!this.auditLanding) return;
          try {
            this.closeAuditModal?.();
            this.versionLanding = this.auditLanding;
            this.versions = [];
            this.newVersionDescription = '';
            this.showVersionsModal = true;
            await this.loadVersions();
            this.$nextTick(() => {
              const versionElement = document.querySelector(`[data-version-id="${versionId}"]`);
              if (versionElement) {
                versionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                versionElement.classList.add('ring-2', 'ring-yellow-400');
                setTimeout(() => versionElement.classList.remove('ring-2', 'ring-yellow-400'), 3000);
              }
            });
          } catch (err) {
            this.showError('Error loading version: ' + err.message);
          }
        }
      };
    }

    window.AppModules = window.AppModules || {};
    window.AppModules.versions = versionsModule;
  })();
</script>
