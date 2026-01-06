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
    // Try to find an enabled provider if not specified
    const { providers } = await saasbackend.services.llm.testPrompt({ key: 'none' }).catch(() => ({ providers: {} }));
    
    // If we have an override key, we'll try to use it
    let providerKey = 'openrouter';
    let options = { temperature: 0.2 };

    if (openrouterApiKey) {
      providerKey = 'openrouter';
      options.apiKey = openrouterApiKey;
      options.baseUrl = 'https://openrouter.ai/api/v1';
      options.model = llmModel;
    } else {
      providerKey = Object.keys(providers).find(k => providers[k].enabled && providers[k].apiKey) || 'openrouter';
      options.model = llmModel;
    }

    const response = await saasbackend.services.llm.callAdhoc({
      providerKey,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userRequest }
      ]
    }, options);

    // Clean up any markdown if the LLM ignored instructions
    let yaml = response.content.trim();
    if (yaml.startsWith('```')) {
      yaml = yaml.replace(/^```yaml\n?/, '').replace(/\n?```$/, '');
    }
    
    return yaml;
  }
  
  throw new Error('LLM service not available in saasbackend. Check if LLM is configured in System Settings.');
}

/**
 * Edits landing page content using AI based on user requirements.
 * @param {string} userRequest - The user's description of changes.
 * @param {string} currentContent - The current HTML content of the landing.
 * @param {Object} context - Additional context (slug, title, etc.)
 * @returns {Promise<string>} - The modified HTML content.
 */
async function editLandingContent(userRequest, currentContent, context = {}) {
  const { slug, title } = context;
  const openrouterApiKey = await getTraefikSetting('LLM_OPENROUTER_API_KEY');
  const llmModel = await getTraefikSetting('LLM_MODEL') || 'minimax/minimax-m2.1';
  
  const systemPrompt = `You are an expert Senior Web Developer and Conversion Rate Optimization (CRO) specialist.
Your task is to modify the provided HTML content of a landing page according to the user's request.

Rules:
1. Return ONLY the complete, valid HTML content. 
2. DO NOT include markdown code blocks (\`\`\`html). No explanations, no talk.
3. Preserve the general structure unless asked to change it.
4. Keep all existing script tags and external CSS links unless asked to remove them.
5. If the user asks for a new section, ensure it matches the existing style (Tailwind CSS is likely used).
6. Ensure the output is a full valid HTML document if the input was one.

Context:
- Landing Slug: ${slug || 'unknown'}
- Landing Title: ${title || 'Untitled Landing'}

Current Content:
${currentContent}
`;

  if (saasbackend.services && saasbackend.services.llm) {
    const { providers } = await saasbackend.services.llm.testPrompt({ key: 'none' }).catch(() => ({ providers: {} }));
    
    let providerKey = 'openrouter';
    let options = { temperature: 0.1 }; // Lower temperature for more consistent code generation

    if (openrouterApiKey) {
      providerKey = 'openrouter';
      options.apiKey = openrouterApiKey;
      options.baseUrl = 'https://openrouter.ai/api/v1';
      options.model = llmModel;
    } else {
      providerKey = Object.keys(providers).find(k => providers[k].enabled && providers[k].apiKey) || 'openrouter';
      options.model = llmModel;
    }

    console.log(`🤖 AI Edit Request: model=${options.model}, provider=${providerKey}`);
    
    // Add a timeout to the LLM call to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('LLM request timed out after 60s')), 60000)
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
    let html = response.content.trim();
    if (html.startsWith('```')) {
      html = html.replace(/^```html\n?/, '').replace(/\n?```$/, '');
    }
    
    return html;
  }
  
  throw new Error('LLM service not available in saasbackend.');
}

module.exports = {
  generateTraefikYaml,
  editLandingContent
};
