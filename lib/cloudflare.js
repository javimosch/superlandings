const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

function isCloudflareEnabled() {
  const token = process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_API_TOKEN.trim();
  const key = process.env.CLOUDFLARE_API_KEY && process.env.CLOUDFLARE_API_KEY.trim();
  const email = process.env.CLOUDFLARE_EMAIL && process.env.CLOUDFLARE_EMAIL.trim();
  return !!token || (!!key && !!email);
}

function getAuthHeaders() {
  const token = process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_API_TOKEN.trim();
  const key = process.env.CLOUDFLARE_API_KEY && process.env.CLOUDFLARE_API_KEY.trim();
  const email = process.env.CLOUDFLARE_EMAIL && process.env.CLOUDFLARE_EMAIL.trim();

  if (token) {
    return { Authorization: `Bearer ${token}` };
  }

  if (key && email) {
    return {
      'X-Auth-Email': email,
      'X-Auth-Key': key
    };
  }

  throw new Error('Cloudflare integration is not enabled. Provide CLOUDFLARE_API_TOKEN or (CLOUDFLARE_API_KEY + CLOUDFLARE_EMAIL).');
}

function getTraefikTargetIp() {
  const ip = process.env.TRAEFIK_REMOTE_HOST;
  if (!ip || !ip.trim()) {
    throw new Error('Missing TRAEFIK_REMOTE_HOST in env. It is required as DNS target IP.');
  }
  return ip.trim();
}

function getDefaultProxied() {
  return (process.env.CLOUDFLARE_PROXY_DEFAULT || 'false').toLowerCase() === 'true';
}

function getDefaultTtl() {
  const raw = process.env.CLOUDFLARE_DNS_TTL;
  if (!raw || !raw.trim()) return 1;
  const ttl = Number(raw);
  if (!Number.isFinite(ttl) || ttl < 1) return 1;
  return ttl;
}

function getAuthMode() {
  const token = process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_API_TOKEN.trim();
  if (token) return 'token';
  const key = process.env.CLOUDFLARE_API_KEY && process.env.CLOUDFLARE_API_KEY.trim();
  const email = process.env.CLOUDFLARE_EMAIL && process.env.CLOUDFLARE_EMAIL.trim();
  if (key && email) return 'key-email';
  return 'none';
}

async function cfFetch(path, { method = 'GET', query, body } = {}) {
  const url = new URL(CLOUDFLARE_API_BASE + path);
  const authHeaders = getAuthHeaders();
  const authPreview = (() => {
    const token = process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_API_TOKEN.trim();
    const key = process.env.CLOUDFLARE_API_KEY && process.env.CLOUDFLARE_API_KEY.trim();
    const email = process.env.CLOUDFLARE_EMAIL && process.env.CLOUDFLARE_EMAIL.trim();
    if (token) return { Authorization: `Bearer len=${token.length}` };
    if (key && email) return { 'X-Auth-Email': email, 'X-Auth-Key': `len=${key.length}` };
    return {};
  })();

  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      url.searchParams.set(k, String(v));
    });
  }

  // Debug logging without leaking secrets
  console.log('[CF] Request', {
    method,
    url: url.toString(),
    query: query || null,
    authMode: getAuthMode(),
    headers: Object.keys(authHeaders)
  });

  const baseHeaders = { ...authHeaders, 'Accept': 'application/json' };
  const hasBody = body !== undefined && body !== null;
  const headers = hasBody ? { ...baseHeaders, 'Content-Type': 'application/json' } : baseHeaders;

  const res = await fetch(url, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const errorChain = Array.isArray(data?.errors)
      ? data.errors.map(e => ({ code: e.code, message: e.message, error_chain: e.error_chain }))
      : null;
    const errorChainSerialized = errorChain ? JSON.stringify(errorChain) : null;
    console.error('[CF] Error response', {
      status: res.status,
      statusText: res.statusText,
      body: data,
      errors: data?.errors,
      errorChain,
      errorChainSerialized,
      authMode: getAuthMode(),
      authPreview
    });
    const firstError = data?.errors?.[0];
    const msg = firstError?.message
      ? `${firstError.message}${firstError.code ? ` (code ${firstError.code})` : ''}`
      : data?.message || `Cloudflare API error (${res.status})`;
    throw new Error(msg);
  }

  if (!data || data.success !== true) {
    const errorChain = Array.isArray(data?.errors)
      ? data.errors.map(e => ({ code: e.code, message: e.message, error_chain: e.error_chain }))
      : null;
    const errorChainSerialized = errorChain ? JSON.stringify(errorChain) : null;
    console.error('[CF] Unexpected response', { body: data, errorChain, errorChainSerialized, authMode: getAuthMode(), authPreview });
    const firstError = data?.errors?.[0];
    const msg = firstError?.message
      ? `${firstError.message}${firstError.code ? ` (code ${firstError.code})` : ''}`
      : data?.message || 'Cloudflare API error';
    throw new Error(msg);
  }

  return data.result;
}

function normalizeDomain(input) {
  const domain = String(input || '').trim().toLowerCase();
  if (!domain) return '';
  return domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function domainCandidates(domain) {
  const parts = domain.split('.').filter(Boolean);
  const candidates = [];
  for (let i = 0; i <= parts.length - 2; i += 1) {
    candidates.push(parts.slice(i).join('.'));
  }
  return candidates;
}

async function resolveZoneForDomain(domainInput) {
  const domain = normalizeDomain(domainInput);
  if (!domain) throw new Error('Domain is required');

  const candidates = domainCandidates(domain);
  for (const candidate of candidates) {
    const zones = await cfFetch('/zones', { query: { name: candidate, status: 'active', per_page: 50 } });
    if (Array.isArray(zones) && zones.length > 0) {
      return zones[0];
    }
  }

  throw new Error(`No active Cloudflare zone found for domain: ${domain}`);
}

async function listDnsRecords(zoneId, { type, name } = {}) {
  return cfFetch(`/zones/${zoneId}/dns_records`, { query: { type, name, per_page: 100 } });
}

async function deleteDnsRecord(zoneId, recordId) {
  await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, { method: 'DELETE' });
}

async function createDnsRecord(zoneId, payload) {
  return cfFetch(`/zones/${zoneId}/dns_records`, { method: 'POST', body: payload });
}

async function verifyCloudflareToken() {
  if (!isCloudflareEnabled()) {
    throw new Error('Cloudflare integration is not enabled');
  }

  // Minimal token verification: list zones.
  // If token is invalid or lacks permissions, Cloudflare returns an API error.
  const zones = await cfFetch('/zones', { query: { per_page: 1 } });
  return Array.isArray(zones) ? zones.length : 0;
}

function desiredRecords(zoneName) {
  const targetIp = getTraefikTargetIp();
  const ttl = getDefaultTtl();
  const proxied = getDefaultProxied();

  return [
    {
      type: 'A',
      name: zoneName,
      content: targetIp,
      ttl,
      proxied
    },
    {
      type: 'A',
      name: `*.${zoneName}`,
      content: targetIp,
      ttl,
      proxied
    },
    {
      type: 'CNAME',
      name: `www.${zoneName}`,
      content: zoneName,
      ttl,
      proxied
    }
  ];
}

function isSameRecord(existing, desired) {
  return (
    existing &&
    existing.type === desired.type &&
    String(existing.name || '').toLowerCase() === String(desired.name || '').toLowerCase() &&
    String(existing.content || '').toLowerCase() === String(desired.content || '').toLowerCase() &&
    Boolean(existing.proxied) === Boolean(desired.proxied)
  );
}

function isConflict(existing, desired) {
  if (!existing) return false;

  const desiredName = String(desired.name || '').toLowerCase();
  const existingName = String(existing.name || '').toLowerCase();
  if (desiredName !== existingName) return false;

  const conflictTypes = new Set(['A', 'AAAA', 'CNAME', 'TXT']);
  if (!conflictTypes.has(existing.type)) return false;

  return !isSameRecord(existing, desired);
}

async function configureDnsForDomain(domainInput) {
  if (!isCloudflareEnabled()) {
    throw new Error('Cloudflare integration is not enabled');
  }

  const zone = await resolveZoneForDomain(domainInput);
  const zoneName = zone.name;
  const desired = desiredRecords(zoneName);

  const namesToCheck = Array.from(new Set(desired.map(r => r.name)));
  const existingByName = new Map();

  for (const name of namesToCheck) {
    const records = await listDnsRecords(zone.id, { name });
    existingByName.set(String(name).toLowerCase(), Array.isArray(records) ? records : []);
  }

  const steps = [];
  const removed = [];
  const added = [];
  const skipped = [];

  for (const d of desired) {
    const key = String(d.name).toLowerCase();
    const existing = existingByName.get(key) || [];

    const conflicts = existing.filter(r => isConflict(r, d));
    for (const conflict of conflicts) {
      steps.push({
        action: 'remove',
        message: `Removing conflicting ${conflict.type} record: ${conflict.name} -> ${conflict.content}`,
        record: { id: conflict.id, type: conflict.type, name: conflict.name, content: conflict.content, proxied: conflict.proxied }
      });
      await deleteDnsRecord(zone.id, conflict.id);
      removed.push({ type: conflict.type, name: conflict.name, content: conflict.content, proxied: conflict.proxied });
    }

    const refreshed = await listDnsRecords(zone.id, { name: d.name });
    const exact = (Array.isArray(refreshed) ? refreshed : []).find(r => isSameRecord(r, d));

    if (exact) {
      steps.push({
        action: 'skip',
        message: `Record already correct: ${d.type} ${d.name} -> ${d.content}`,
        record: { type: d.type, name: d.name, content: d.content, proxied: d.proxied }
      });
      skipped.push({ type: d.type, name: d.name, content: d.content, proxied: d.proxied });
      continue;
    }

    steps.push({
      action: 'add',
      message: `Adding ${d.type} record: ${d.name} -> ${d.content}`,
      record: { type: d.type, name: d.name, content: d.content, proxied: d.proxied }
    });

    const created = await createDnsRecord(zone.id, {
      type: d.type,
      name: d.name,
      content: d.content,
      ttl: d.ttl,
      proxied: d.proxied
    });

    added.push({ type: created.type, name: created.name, content: created.content, proxied: created.proxied });
  }

  const info = `DNS configured for ${zoneName}. Root domain (${zoneName}) and any subdomain (*.${zoneName}) will point to ${getTraefikTargetIp()}. The www subdomain (www.${zoneName}) aliases the root domain. DNS propagation may take some time.`;

  return {
    zone: { id: zone.id, name: zone.name },
    targetIp: getTraefikTargetIp(),
    steps,
    removed,
    added,
    skipped,
    info
  };
}

module.exports = {
  isCloudflareEnabled,
  verifyCloudflareToken,
  configureDnsForDomain
};
