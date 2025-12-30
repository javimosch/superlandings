<script>
  (function () {
    function organizationsModule(services, helpers) {
      const orgs = services?.organizations ? services.organizations() : null;

      return {
        // Organizations
        async loadOrganizations() {
          try {
            if (!orgs) throw new Error('Organizations service missing');
            const data = await orgs.list();
            this.organizations = data;
            if (this.authInfo.isAdmin) {
              this.allOrganizations = data;
            }
          } catch (err) {
            this.showError('Error loading organizations: ' + err.message);
          }
        },

        async createOrganization() {
          try {
            if (!orgs) throw new Error('Organizations service missing');
            const { ok, data } = await orgs.create(this.newOrgName);
            if (!ok) throw new Error(data.error || 'Failed to create organization');
            this.showSuccess('Organization created!');
            this.newOrgName = '';
            await this.loadOrganizations();
          } catch (err) {
            this.showError('Error creating organization: ' + err.message);
          }
        },

        async saveOrganization() {
          try {
            if (!orgs) throw new Error('Organizations service missing');
            const { ok, data } = await orgs.update(this.editingOrg.id, this.editingOrg.name);
            if (!ok) throw new Error(data.error || 'Failed to update organization');
            this.showSuccess('Organization updated!');
            this.editingOrg = null;
            await this.loadOrganizations();
          } catch (err) {
            this.showError('Error updating organization: ' + err.message);
          }
        },

        async deleteOrganization(id) {
          try {
            if (!orgs) throw new Error('Organizations service missing');
            const { ok, data } = await orgs.remove(id);
            if (!ok) throw new Error(data.error || 'Failed to delete organization');
            this.showSuccess('Organization deleted!');
            await this.loadOrganizations();
          } catch (err) {
            this.showError('Error deleting organization: ' + err.message);
          }
        },

        // Users (admin)
        async loadAllUsers() {
          try {
            const res = await fetch('/api/users');
            this.allUsers = await res.json();
          } catch (err) {
            console.error('Error loading users:', err);
          }
        },

        async loadAvailableRights() {
          try {
            const res = await fetch('/api/users/rights');
            this.availableRights = await res.json();
          } catch (err) {
            console.error('Error loading rights:', err);
          }
        },

        async createUser() {
          try {
            const res = await fetch('/api/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: this.newUserEmail, password: this.newUserPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            this.showSuccess('User created!');
            this.newUserEmail = '';
            this.newUserPassword = '';
            await this.loadAllUsers();
          } catch (err) {
            this.showError('Error creating user: ' + err.message);
          }
        },

        async deleteUser(email) {
          try {
            const res = await fetch(`/api/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            this.showSuccess('User deleted!');
            await this.loadAllUsers();
            await this.loadOrganizations();
          } catch (err) {
            this.showError('Error deleting user: ' + err.message);
          }
        },

        availableUsersForOrg(org) {
          const orgUserEmails = org.users?.map(u => u.email) || [];
          return this.allUsers.filter(u => !orgUserEmails.includes(u.email));
        },

        async addUserToOrganization(orgId) {
          try {
            if (!orgs) throw new Error('Organizations service missing');
            const { ok, data } = await orgs.addUser(orgId, this.addUserEmail);
            if (!ok) throw new Error(data.error || 'Failed to add user');
            this.showSuccess('User added to organization!');
            this.showAddUserToOrg = null;
            this.addUserEmail = '';
            await this.loadOrganizations();
          } catch (err) {
            this.showError('Error adding user: ' + err.message);
          }
        },

        async removeUserFromOrganization(orgId, email) {
          try {
            if (!orgs) throw new Error('Organizations service missing');
            const { ok, data } = await orgs.removeUser(orgId, email);
            if (!ok) throw new Error(data.error || 'Failed to remove user');
            this.showSuccess('User removed from organization!');
            await this.loadOrganizations();
          } catch (err) {
            this.showError('Error removing user: ' + err.message);
          }
        },

        openUserRightsModal(org, user) {
          this.editingUserRights = {
            orgId: org.id,
            orgName: org.name,
            email: user.email,
            rights: [...(user.rights || [])]
          };
          this.showUserRightsModal = true;
        },

        selectAllRights() { this.editingUserRights.rights = [...this.availableRights]; },
        selectNoRights() { this.editingUserRights.rights = []; },

        async saveUserRights() {
          try {
            if (!orgs) throw new Error('Organizations service missing');
            const { ok, data } = await orgs.saveUserRights(
              this.editingUserRights.orgId,
              this.editingUserRights.email,
              this.editingUserRights.rights
            );
            if (!ok) throw new Error(data.error || 'Failed to update rights');
            this.showSuccess('Rights updated!');
            this.showUserRightsModal = false;
            await this.loadOrganizations();
          } catch (err) {
            this.showError('Error updating rights: ' + err.message);
          }
        },

        // Move landing between orgs
        openMoveModal(landing) {
          this.movingLanding = landing;
          this.moveTargetOrgId = '';
          this.showMoveModal = true;
        },

        async moveLanding() {
          this.loading.move = true;
          try {
            if (!orgs) throw new Error('Organizations service missing');
            const { ok, data } = await orgs.moveLanding(this.movingLanding.id, this.moveTargetOrgId);
            if (!ok) throw new Error(data.error || 'Failed to move landing');
            this.showSuccess(data.message || 'Landing moved');
            this.showMoveModal = false;
            this.loadLandings?.();
          } catch (err) {
            this.showError('Error moving landing: ' + err.message);
          } finally {
            this.loading.move = false;
          }
        }
      };
    }

    window.AppModules = window.AppModules || {};
    window.AppModules.organizations = organizationsModule;
  })();
</script>
