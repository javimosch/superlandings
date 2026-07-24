/* SuperLandings Admin v2 — API service layer */
const API = (() => {
  let currentOrgId = null;
  const setOrg = (id) => { currentOrgId = id; };
  const getHeaders = (extra = {}) => {
    const h = { ...extra };
    if (currentOrgId) h['X-Organization-Id'] = currentOrgId;
    return h;
  };
  const req = async (method, path, body, opts = {}) => {
    const isForm = body instanceof FormData;
    const headers = getHeaders(opts.headers || {});
    if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';
    const r = await fetch(path, {
      method, headers,
      credentials: 'include',
      body: isForm ? body : (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const text = await r.text();
    let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!r.ok) throw { status: r.status, ...data };
    return data;
  };
  return {
    setOrg,
    // Auth
    login: (u, p) => req('POST', '/api/login', { username: u, password: p }),
    logout: () => req('GET', '/api/logout'),
    me: () => req('GET', '/api/auth/me'),
    // Landings
    landings: {
      list: () => req('GET', '/api/landings'),
      get: (id) => req('GET', `/api/landings/${id}/content`),
      create: (form) => req('POST', '/api/landings', form),
      update: (id, body) => req('PUT', `/api/landings/${id}`, body),
      updateForm: (id, form) => req('PUT', `/api/landings/${id}`, form),
      delete: (id, sshKey) => req('DELETE', `/api/landings/${id}`, undefined, { headers: { 'X-SSH-Key': sshKey || '' } }),
      clearCache: (id) => req('POST', `/api/landings/${id}/cache/clear`),
      aiEdit: (id, prompt, content) => req('POST', `/api/landings/${id}/ai-edit`, { prompt, currentContent: content }),
      generateTraefik: (prompt, slug, domains) => req('POST', '/api/landings/generate-traefik-config', { prompt, slug, domains }),
    },
    // Versions
    versions: {
      list: (id) => req('GET', `/api/landings/${id}/versions`),
      create: (id, desc) => req('POST', `/api/landings/${id}/versions`, { description: desc }),
      get: (id, vid) => req('GET', `/api/landings/${id}/versions/${vid}`),
      preview: (id, vid) => req('GET', `/api/landings/${id}/versions/${vid}/preview`),
      diff: (id, vid, compareTo) => req('GET', `/api/landings/${id}/versions/${vid}/diff?compareTo=${compareTo}`),
      rollback: (id, vid) => req('POST', `/api/landings/${id}/versions/${vid}/rollback`),
      delete: (id, vid) => req('DELETE', `/api/landings/${id}/versions/${vid}`),
      update: (id, vid, body) => req('PUT', `/api/landings/${id}/versions/${vid}`, body),
    },
    // Domains & publishing
    domains: {
      update: (id, domains) => req('PUT', `/api/landings/${id}/domains`, { domains }),
      publish: (id, sshKey) => req('POST', `/api/landings/${id}/publish`, { sshKey }),
      unpublish: (id, sshKey) => req('POST', `/api/landings/${id}/unpublish`, { sshKey }),
      publishOne: (id, domain, sshKey) => req('POST', `/api/landings/${id}/domains/${encodeURIComponent(domain)}/publish`, { sshKey }),
      unpublishOne: (id, domain, sshKey) => req('POST', `/api/landings/${id}/domains/${encodeURIComponent(domain)}/unpublish`, { sshKey }),
    },
    // Audit
    audit: {
      list: (id, limit = 50, offset = 0) => req('GET', `/api/landings/${id}/audit?limit=${limit}&offset=${offset}`),
    },
    // Organizations
    orgs: {
      list: () => req('GET', '/api/organizations'),
      create: (name) => req('POST', '/api/organizations', { name }),
      update: (id, name) => req('PUT', `/api/organizations/${id}`, { name }),
      delete: (id) => req('DELETE', `/api/organizations/${id}`),
      addUser: (id, email, rights) => req('POST', `/api/organizations/${id}/users`, { email, rights }),
      updateUser: (id, email, rights) => req('PUT', `/api/organizations/${id}/users/${encodeURIComponent(email)}`, { rights }),
      removeUser: (id, email) => req('DELETE', `/api/organizations/${id}/users/${encodeURIComponent(email)}`),
    },
    // Users
    users: {
      list: () => req('GET', '/api/users'),
      rights: () => req('GET', '/api/users/rights'),
      create: (email, password) => req('POST', '/api/users', { email, password }),
      update: (email, body) => req('PUT', `/api/users/${encodeURIComponent(email)}`, body),
      delete: (email) => req('DELETE', `/api/users/${encodeURIComponent(email)}`),
    },
    // Settings
    config: {
      get: () => req('GET', '/api/admin-config'),
      fallbacks: () => req('GET', '/api/admin-config/fallbacks'),
      updateDomains: (domains) => req('PUT', '/api/admin-config/domains', { domains }),
      publish: (sshKey) => req('POST', '/api/admin-config/publish', { sshKey }),
      unpublish: (sshKey) => req('POST', '/api/admin-config/unpublish', { sshKey }),
      saveSettings: (settings) => req('PUT', '/api/admin-config/settings', { settings }),
    },
    // Cloudflare
    cloudflare: {
      status: () => req('GET', '/api/cloudflare/status'),
      connect: (email) => req('POST', '/api/cloudflare/connect', email ? { email } : {}),
      disconnect: () => req('POST', '/api/cloudflare/disconnect'),
      configureDns: (domain) => req('POST', '/api/cloudflare/dns/configure', { domain }),
    },
    // Migration
    migration: {
      rbac: () => req('POST', '/api/migration/rbac'),
      versions: () => req('POST', '/api/migration/versions'),
      moveLanding: (landingId, targetOrgId) => req('POST', '/api/migration/move-landing', { landingId, targetOrganizationId: targetOrgId }),
    },
  };
})();
