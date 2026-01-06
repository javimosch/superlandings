<script>
  // Reactive state factory for the admin app.
  (function () {
    function createState() {
      return {
        // Auth & Organizations
        authInfo: { isAdmin: false, user: null, organizations: [], rights: [] },
        organizations: [],
        allOrganizations: [],
        currentOrganization: null,
        showOrgSwitcher: false,
        showMobileMenu: false,

        // Landings
        landings: [],
        showAddModal: false,
        showEditModal: false,
        newLanding: {
          name: '',
          slug: '',
          type: 'html',
          domains: [],
          content: '<!DOCTYPE html>\\n<html>\\n<head>\\n  <title>New Landing</title>\\n</head>\\n<body>\\n  <h1>Hello World!</h1>\\n</body>\\n</html>'
        },
        selectedEjsFiles: [],
        selectedEjsZip: null,
        editSelectedEjsFiles: [],
        editSelectedEjsZip: null,
        editingLanding: null,
        addEditor: null,
        editEditor: null,

        // Domains
        editingDomains: null,
        showDomainsModal: false,
        showAdminDomainsModal: false,
        adminConfig: { domains: [], published: false, traefikConfigFile: '' },

        // Cloudflare DNS
        cloudflareStatus: { enabled: false, connected: false, connectedAt: null, email: null },
        cloudflareDomainInput: '',
        cloudflareRecap: { steps: [], info: '' },

        // Organizations Modal
        showOrganizationsModal: false,
        traefikAiPrompt: '',
        landingAiPrompt: '',
        generatingAi: false,
        allUsers: [],
        newUserEmail: '',
        newUserPassword: '',
        showAddUserToOrg: null,
        addUserEmail: '',
        availableRights: [],

        // User Rights Modal
        showUserRightsModal: false,
        editingUserRights: null,

        // Move Landing Modal
        showMoveModal: false,
        movingLanding: null,
        moveTargetOrgId: '',

        // Versions Modal
        showVersionsModal: false,
        versionLanding: null,
        versions: [],
        newVersionDescription: '',
        showVersionPreviewModal: false,
        previewingVersion: null,
        versionPreviewContent: '',

        // Confirmation dialogs
        showRollbackConfirm: false,
        showDeleteConfirm: false,
        confirmingVersion: null,

        // Version editing
        editingVersionDescription: false,
        editingVersionTag: false,
        editingVersionId: null,
        tempDescription: '',
        tempTag: '',

        // Diff Modal
        showDiffModal: false,
        diffData: null,
        collapsedFiles: {},

        // HTML View Modal
        showVersionHtmlModal: false,
        viewingHtmlVersion: null,
        versionHtmlContent: '',

        // Audit Modal
        showAuditModal: false,
        auditLanding: null,
        auditEntries: [],
        auditTotal: 0,
        auditHasMore: false,
        auditOffset: 0,

        // Preview Modal
        showPreviewModal: false,
        previewContent: '',
        previewMode: 'modal',

        // UI State
        loading: {},
        toastId: 0,
        isMounted: false,
        showLoading: false,
        iconsInitialized: false,

        // Toast store (DOM managed)
        toastStore: null
      };
    }

    window.createAdminState = createState;
  })();
</script>
