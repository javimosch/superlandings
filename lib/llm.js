const saasbackend = process.env.NODE_ENV === 'production'
  ? require('saasbackend')
  : require('../ref-saasbackend');
const { getTraefikSetting } = require('./traefik-settings');

/**
 * Generates a Traefik configuration using AI based on user requirements.
 * @param {string} userRequest - The user's description of what they want to achieve.
 * @param {Object} context - Contextual information (slug, domains, etc.)
 * @returns {Promise<string>} - The generated YAML configuration.
 */
async function generateTraefikYaml(userRequest, context = {}) {
  const { slug, domains } = context;
  const serverIp = await getTraefikSetting('SERVER_IP') || 'YOUR_SERVER_IP';
  const openrouterApiKey = await getTraefikSetting('LLM_OPENROUTER_API_KEY');
  const llmModel = await getTraefikSetting('LLM_MODEL') || 'minimax/minimax-m2.1';
  const llmTemperature = parseFloat(await getTraefikSetting('LLM_TEMPERATURE')) || 0.2;
  const llmTimeout = parseInt(await getTraefikSetting('LLM_TIMEOUT_SECONDS'), 10) || 80;
  
  const systemPrompt = `You are a Traefik v2/v3 configuration expert. 
Generate a valid YAML configuration for Traefik dynamic file provider.
Focus on http.routers, http.middlewares, and http.services.

Context:
- Server IP (where Superlandings is running): ${serverIp}
- Landing Slug: ${slug || 'example-landing'}
- Domains: ${domains && domains.length > 0 ? domains.join(', ') : 'No custom domains'}

Rules:
1. Return ONLY the raw YAML content. DO NOT include markdown code blocks (\`\`\`yaml). No explanations.
2. If the user asks for a redirect, use 'redirectRegex' or 'redirectScheme' middlewares.
3. If the user asks for a reverse proxy, use 'loadBalancer.servers' in 'services'.
4. Ensure router names and service names are unique, prefixed with 'sl-${slug || 'custom'}-'.
5. For custom domains, use 'tls.certresolver: letsencrypt' and 'entryPoints: [https]'.
6. If no domains are provided, generate rules for Host(\`${serverIp}\`) and PathPrefix(\`/${slug}\`).

Reference Example:
http:
  routers:
    superlandings-superlanding-docs:
      entryPoints:
        - https
      service: superlandings-superlanding-docs
      rule: Host('superlandings.intrane.fr')
      middlewares:
        - superlandings-superlanding-docs-addprefix
      tls:
        certresolver: letsencrypt
  middlewares:
    superlandings-superlanding-docs-addprefix:
      addPrefix:
        prefix: /superlanding-docs
  services:
    superlandings-superlanding-docs:
      loadBalancer:
        servers:
          - url: 'http://superlandings:3000'

Reference Redirect Example:
http:
  routers:
    sl-toto-toto-microexits-cc:
      entryPoints:
        - https
      rule: Host('toto.microexits.cc')
      middlewares:
        - sl-toto-redirect-to-microexits-cc
      service: noop@internal
      tls:
        certresolver: letsencrypt

  middlewares:
    sl-toto-redirect-to-microexits-cc:
      redirectRegex:
        regex: '^https?://toto\\.microexits\\.cc/?(.*)$'
        replacement: 'https://microexits.cc/$1'
        permanent: false

User Request: ${userRequest}
`;

  if (saasbackend.services && saasbackend.services.llm) {
    const { providers } = await saasbackend.services.llm.testPrompt({ key: 'none' }).catch(() => ({ providers: {} }));
    
    let providerKey = 'openrouter';
    let options = { temperature: llmTemperature };
    let providerSource = 'llm_config';

    if (openrouterApiKey) {
      providerKey = 'openrouter';
      options.apiKey = openrouterApiKey;
      options.baseUrl = 'https://openrouter.ai/api/v1';
      options.model = llmModel;
      providerSource = 'global_settings';
    } else {
      providerKey = Object.keys(providers).find(k => providers[k].enabled && providers[k].apiKey) || 'openrouter';
      options.model = llmModel;
      providerSource = 'llm_config';
    }

    // Add timeout to options if provided by saasbackend provider or our override
    const providerConfig = providers[providerKey] || {};
    let timeoutSource = 'default';
    let effectiveTimeout = 80;

    if (llmTimeout) {
      effectiveTimeout = llmTimeout;
      timeoutSource = 'global_settings';
    } else if (providerConfig.timeout) {
      effectiveTimeout = providerConfig.timeout;
      timeoutSource = 'llm_config';
    }

    options.auditContext = {
      providerSource,
      timeoutSource,
      computedTimeoutMs: effectiveTimeout * 1000
    };

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`LLM request timed out after ${effectiveTimeout}s`)), effectiveTimeout * 1000)
    );

    const response = await Promise.race([
      saasbackend.services.llm.callAdhoc({
        providerKey,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userRequest }
        ]
      }, options),
      timeoutPromise
    ]);

    // Clean up any markdown if the LLM ignored instructions
    let yaml = response.content.trim();
    if (yaml.startsWith('```')) {
      yaml = yaml.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
    }
    
    return yaml;
  }
  
  throw new Error('LLM service not available in saasbackend. Check if LLM is configured in System Settings.');
}

/**
 * Log a patch failure to the audit log.
 */
async function logPatchFailure(err, context = {}, isRetry = false) {
  try {
    const { AuditEvent } = saasbackend.models;
    if (!AuditEvent) return;

    const event = new AuditEvent({
      actorType: 'system',
      action: isRetry ? 'llm.patch_retry_fallback' : 'llm.patch_failure',
      outcome: 'failure',
      meta: {
        error_code: err.code || 'UNKNOWN',
        error_message: err.message,
        prompt: context.prompt,
        model: context.model,
        auditContext: context.auditContext || null,
        // Include a sample of the raw response if available
        ai_response_sample: context.rawResponse ? String(context.rawResponse).substring(0, 500) : null
      }
    });
    await event.save();
    console.log(`🤖 AI Patch ${isRetry ? 'retry' : 'failure'} audited: ${err.code || err.message}`);
  } catch (auditErr) {
    console.error('🤖 Failed to log AI patch failure audit:', auditErr.message);
  }
}

/**
 * Parses diff blocks from LLM response (SEARCH/REPLACE format).
 * @param {string} content 
 * @returns {Array<{search: string, replace: string}>}
 */
function parseDiffBlocks(content) {
  const blocks = [];
  const regex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
  let match;

  while ((match = regex.exec(String(content || ''))) !== null) {
    blocks.push({ search: match[1], replace: match[2] });
  }

  return blocks;
}

/**
 * Applies diff blocks to original text.
 * @param {string} originalText 
 * @param {Array<{search: string, replace: string}>} diffBlocks 
 * @returns {string}
 */
function applyDiffs(originalText, diffBlocks) {
  let result = String(originalText || '');
  const appliedRanges = [];

  for (const block of diffBlocks) {
    const index = result.indexOf(block.search);
    if (index === -1) {
      const err = new Error('Could not find SEARCH block in file. Make sure the search block matches exactly.');
      err.code = 'DIFF_MATCH_FAILED';
      throw err;
    }

    // Check for overlaps (simplified)
    const overlaps = appliedRanges.some(([start, end]) =>
      (index >= start && index < end) ||
      (index + block.search.length > start && index + block.search.length <= end),
    );

    if (overlaps) {
      const err = new Error('Overlapping diff blocks detected');
      err.code = 'DIFF_OVERLAP';
      throw err;
    }

    result = result.substring(0, index) + block.replace + result.substring(index + block.search.length);
    appliedRanges.push([index, index + block.replace.length]);
  }

  return result;
}

/**
 * Edits landing page content using AI based on user requirements.
 * Uses a patch-based approach for faster completion and reduced token usage.
 * @param {string} userRequest - The user's description of changes.
 * @param {string} currentContent - The current HTML content of the landing.
 * @param {Object} context - Additional context (slug, title, etc.)
 * @returns {Promise<string>} - The modified HTML content.
 */
async function editLandingContent(userRequest, currentContent, context = {}) {
  const { slug, title } = context;
  const openrouterApiKey = await getTraefikSetting('LLM_OPENROUTER_API_KEY');
  const llmModel = await getTraefikSetting('LLM_MODEL') || 'minimax/minimax-m2.1';
  const llmTemperature = parseFloat(await getTraefikSetting('LLM_TEMPERATURE')) || 0.1;
  const llmTimeout = parseInt(await getTraefikSetting('LLM_TIMEOUT_SECONDS'), 10) || 80;
  
  const systemPrompt = `You are an expert Senior Web Developer and Conversion Rate Optimization (CRO) specialist.
Your task is to modify the provided HTML content of a landing page according to the user's request.

Rules:
1. Return ONLY the changes using SEARCH/REPLACE blocks.
2. DO NOT return the full file.
3. Each block must follow this format:
<<<<<<< SEARCH
[exact text to find]
=======
[replacement text]
>>>>>>> REPLACE
4. The SEARCH block must match character-by-character, including whitespace and indentation.
5. Include enough context in the SEARCH block to make it unique.
6. If no changes are needed, return an empty response.

Context:
- Landing Slug: ${slug || 'unknown'}
- Landing Title: ${title || 'Untitled Landing'}

Current Content:
${currentContent}
`;

  if (saasbackend.services && saasbackend.services.llm) {
    const { providers } = await saasbackend.services.llm.testPrompt({ key: 'none' }).catch(() => ({ providers: {} }));
    
    let providerKey = 'openrouter';
    let options = { temperature: llmTemperature };
    let providerSource = 'llm_config';

    if (openrouterApiKey) {
      providerKey = 'openrouter';
      options.apiKey = openrouterApiKey;
      options.baseUrl = 'https://openrouter.ai/api/v1';
      options.model = llmModel;
      providerSource = 'global_settings';
    } else {
      providerKey = Object.keys(providers).find(k => providers[k].enabled && providers[k].apiKey) || 'openrouter';
      options.model = llmModel;
    }

    console.log(`🤖 AI Patch Request: model=${options.model}, provider=${providerKey}`);
    
    // Add timeout to options if provided by saasbackend provider or our override
    const providerConfig = providers[providerKey] || {};
    let timeoutSource = 'default';
    let effectiveTimeout = 80;

    if (llmTimeout) {
      effectiveTimeout = llmTimeout;
      timeoutSource = 'global_settings';
    } else if (providerConfig.timeout) {
      effectiveTimeout = providerConfig.timeout;
      timeoutSource = 'llm_config';
    }

    options.auditContext = {
      providerSource,
      timeoutSource,
      computedTimeoutMs: effectiveTimeout * 1000
    };

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`LLM request timed out after ${effectiveTimeout}s`)), effectiveTimeout * 1000)
    );

    const response = await Promise.race([
      saasbackend.services.llm.callAdhoc({
        providerKey,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userRequest }
        ]
      }, options),
      timeoutPromise
    ]);

    console.log('🤖 AI Response received');
    const rawResponse = response.content.trim();
    
    // If it looks like it tried to return full HTML (markdown or starts with <!DOCTYPE/<html>), 
    // we should probably handle it or throw. But let's try to parse blocks first.
    const blocks = parseDiffBlocks(rawResponse);
    
    if (blocks.length === 0) {
      // If no blocks found, maybe it returned the full HTML despite instructions?
      // Or maybe it just didn't find anything to change.
      if (rawResponse.toLowerCase().includes('<html') || rawResponse.toLowerCase().includes('<!doctype')) {
         console.warn('🤖 AI returned full HTML instead of patches. Falling back to full replacement.');
         let html = rawResponse;
         if (html.startsWith('```')) {
           html = html.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
         }
         const summary = await summarizeChanges(userRequest, html, true);
         return { content: html, summary };
      }
      console.log('🤖 No changes suggested by AI.');
      return { content: currentContent, summary: 'No changes made' };
    }
    
    try {
      const patchedHtml = applyDiffs(currentContent, blocks);
      const summary = await summarizeChanges(userRequest, blocks);
      return { content: patchedHtml, summary };
    } catch (err) {
      console.error('🤖 Failed to apply AI patches:', err.message);
      
      // Log failure to audit trail
      await logPatchFailure(err, {
        prompt: userRequest,
        model: options.model || llmModel,
        rawResponse: rawResponse,
        auditContext: options.auditContext
      }, true); // Pass true to indicate we're attempting a fallback

      console.log('🤖 Attempting fallback to full rewrite...');
      
      const fallbackSystemPrompt = `You are an expert Senior Web Developer and Conversion Rate Optimization (CRO) specialist.
Your task is to rewrite the provided HTML content of a landing page according to the user's request.

Rules:
1. Return the FULL HTML content.
2. DO NOT use SEARCH/REPLACE blocks.
3. Return ONLY the raw HTML. No markdown code blocks.
4. Maintain the overall structure but apply the requested changes.

Context:
- Landing Slug: ${slug || 'unknown'}
- Landing Title: ${title || 'Untitled Landing'}

Current Content:
${currentContent}
`;

      const fallbackResponse = await Promise.race([
        saasbackend.services.llm.callAdhoc({
          providerKey,
          messages: [
            { role: 'system', content: fallbackSystemPrompt },
            { role: 'user', content: userRequest }
          ]
        }, options),
        timeoutPromise
      ]);

      console.log('🤖 AI Fallback Response received');
      let html = fallbackResponse.content.trim();
      if (html.startsWith('```')) {
        html = html.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
      }
      
      const summary = await summarizeChanges(userRequest, html, true);
      return { content: html, summary };
    }
  }
  
  throw new Error('LLM service not available in saasbackend.');
}

/**
 * Summarizes the changes made by the AI.
 * @param {string} userRequest - The original user request.
 * @param {Array|string} changes - The diff blocks or the full content.
 * @param {boolean} isFullReplacement - Whether it was a full replacement.
 * @returns {Promise<string>} - A short summary of the changes.
 */
async function summarizeChanges(userRequest, changes, isFullReplacement = false) {
  const openrouterApiKey = await getTraefikSetting('LLM_OPENROUTER_API_KEY');
  const llmModel = await getTraefikSetting('LLM_MODEL') || 'minimax/minimax-m2.1';
  const llmTemperature = parseFloat(await getTraefikSetting('LLM_TEMPERATURE')) || 0.3;
  
  const systemPrompt = `You are a technical writer. Summarize the changes made to a web page in a single short sentence (max 10 words).
The user requested: "${userRequest}"
Focus on WHAT was changed, not that AI changed it. Use active voice.`;

  let changeDescription = isFullReplacement ? "Full content replacement" : JSON.stringify(changes);

  if (saasbackend.services && saasbackend.services.llm) {
    const { providers } = await saasbackend.services.llm.testPrompt({ key: 'none' }).catch(() => ({ providers: {} }));
    let providerKey = openrouterApiKey ? 'openrouter' : (Object.keys(providers).find(k => providers[k].enabled && providers[k].apiKey) || 'openrouter');
    let options = { 
      temperature: llmTemperature,
      model: llmModel
    };
    if (openrouterApiKey) {
      options.apiKey = openrouterApiKey;
      options.baseUrl = 'https://openrouter.ai/api/v1';
    }

    try {
      const response = await saasbackend.services.llm.callAdhoc({
        providerKey,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Summarize these changes: ${changeDescription}` }
        ]
      }, options);
      return response.content.trim().replace(/^Summary: /, '').replace(/\"/g, '');
    } catch (err) {
      console.error('🤖 Failed to generate AI summary:', err.message);
      return 'AI-assisted update';
    }
  }
  return 'AI-assisted update';
}

module.exports = {
  generateTraefikYaml,
  editLandingContent
};
