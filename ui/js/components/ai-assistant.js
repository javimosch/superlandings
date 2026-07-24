/* AI Assistant component — quick actions, guided edit, free-text, diff, refinement
   Emits: 'applied' (newContent, summary) | 'reverted' | 'toast' (msg, type)
   Props: landing (object), content (string, current HTML) */
app.component('ai-assistant', {
  props: ['landing', 'content'],
  emits: ['applied', 'reverted', 'toast'],
  setup(props, { emit }) {
    const mode = ref('quick'); // quick | guided | free
    const aiPrompt = ref('');
    const generating = ref(false);
    const summary = ref('');
    const pendingContent = ref(null); // AI output awaiting keep/revert
    const originalBeforeAi = ref(''); // snapshot before AI edit for diff
    // Guided edit form
    const guided = reactive({ section: '', action: '', detail: '' });

    // Quick actions — one-click, generate good prompts internally
    const quickActions = [
      { label: 'Dark mode', icon: 'fa-moon', prompt: 'Change the color scheme to dark mode: dark background (#0a0a0a or similar), light text, muted accent colors. Keep all content and layout the same.' },
      { label: 'Mobile-friendly', icon: 'fa-mobile-screen', prompt: 'Add responsive CSS media queries so the page works well on mobile screens (max-width: 768px). Adjust font sizes, spacing, and layout for small screens. Keep the desktop layout unchanged.' },
      { label: 'Add CTA button', icon: 'fa-bullseye', prompt: 'Add a prominent call-to-action button after the hero section. Use a contrasting accent color, rounded corners, and clear button text like "Get started". Link it to #contact or a placeholder URL.' },
      { label: 'Add contact form', icon: 'fa-envelope', prompt: 'Add a contact form section with name, email, and message fields, plus a submit button. Style it to match the existing design. Place it before the footer.' },
      { label: 'Bigger headings', icon: 'fa-text-height', prompt: 'Increase the font size of all headings (h1, h2, h3) by ~30% and tighten the letter-spacing for a more impactful look. Keep everything else the same.' },
      { label: 'Add testimonials', icon: 'fa-quote-right', prompt: 'Add a testimonials section with 3 placeholder quotes from fictional customers. Include name, role, and company for each. Style as cards with a subtle background. Place after the main content, before the footer.' },
      { label: 'Soften colors', icon: 'fa-palette', prompt: 'Soften the color palette: replace harsh/saturated colors with muted, pastel alternatives. Keep good contrast for readability. Do not change layout or content.' },
      { label: 'Add animations', icon: 'fa-wand-sparkles', prompt: 'Add subtle CSS animations: fade-in-up on headings and sections on scroll (using IntersectionObserver or CSS keyframes), smooth hover transitions on buttons and links. Keep it tasteful and performant.' },
    ];

    // Guided edit options
    const sectionOptions = ['Hero section', 'Features section', 'Pricing section', 'Footer', 'Navigation', 'Whole page', 'Other (describe in detail)'];
    const actionOptions = ['Change colors', 'Change layout', 'Change text', 'Add a subsection', 'Remove something', 'Restyle', 'Other (describe in detail)'];

    // Follow-up refinement suggestions after a successful edit
    const refinementSuggestions = ref([]);
    const generateRefinements = (appliedPrompt) => {
      const s = [];
      if (/dark|color|background/i.test(appliedPrompt)) s.push({ label: 'Adjust the contrast?', prompt: 'Review the color changes and improve contrast where needed for readability.' });
      if (/button|cta|form/i.test(appliedPrompt)) s.push({ label: 'Make the button bigger?', prompt: 'Make the main call-to-action button larger and more prominent.' });
      if (/mobile|responsive/i.test(appliedPrompt)) s.push({ label: 'Test tablet view too?', prompt: 'Also optimize for tablet screens (max-width: 1024px) with appropriate adjustments.' });
      if (/heading|font|text/i.test(appliedPrompt)) s.push({ label: 'Adjust line height?', prompt: 'Improve line-height and paragraph spacing for better readability.' });
      s.push({ label: 'Add more whitespace?', prompt: 'Increase padding and margins throughout for a more spacious, premium feel.' });
      s.push({ label: 'Tighten the layout?', prompt: 'Reduce excessive whitespace and make the layout more compact and focused.' });
      refinementSuggestions.value = s.slice(0, 3);
    };

    const runEdit = async (promptText) => {
      if (!promptText?.trim()) return;
      generating.value = true;
      summary.value = '';
      pendingContent.value = null;
      originalBeforeAi.value = props.content;
      try {
        const data = await API.landings.aiEdit(props.landing.id, promptText, props.content);
        pendingContent.value = data.content;
        summary.value = data.summary || 'Changes ready — review below';
        aiPrompt.value = '';
        generateRefinements(promptText);
      } catch (e) { emit('toast', e.error || 'AI edit failed', 'error'); }
      finally { generating.value = false; }
    };

    // Quick action click
    const runQuick = (action) => runEdit(action.prompt);

    // Guided edit submit
    const runGuided = () => {
      if (!guided.action || !guided.section) return;
      const parts = [`${guided.action} on ${guided.section}.`];
      if (guided.detail.trim()) parts.push(`Details: ${guided.detail.trim()}.`);
      parts.push('Keep the rest of the page unchanged and maintain the existing style.');
      runEdit(parts.join(' '));
    };

    // Free-text submit
    const runFree = () => runEdit(aiPrompt.value);

    // Keep AI changes — emit to parent (which saves)
    const keepChanges = () => {
      if (!pendingContent.value) return;
      emit('applied', pendingContent.value, summary.value);
      pendingContent.value = null;
      summary.value = '';
      refinementSuggestions.value = [];
    };

    // Revert — restore original, emit to parent
    const revertChanges = () => {
      if (!pendingContent.value) return;
      emit('reverted', originalBeforeAi.value);
      pendingContent.value = null;
      summary.value = '';
      refinementSuggestions.value = [];
    };

    // Apply a refinement suggestion
    const runRefinement = (s) => {
      // Refinement runs on the pending content (if not yet kept) or current content
      const base = pendingContent.value || props.content;
      if (pendingContent.value) { keepChanges(); }
      nextTick(() => runEdit(s.prompt));
    };

    // Diff preview iframes
    const originalSrc = computed(() => {
      const blob = new Blob([originalBeforeAi.value || ''], { type: 'text/html' });
      return URL.createObjectURL(blob);
    });
    const pendingSrc = computed(() => {
      const blob = new Blob([pendingContent.value || ''], { type: 'text/html' });
      return URL.createObjectURL(blob);
    });

    return {
      mode, aiPrompt, generating, summary, pendingContent, originalBeforeAi,
      guided, quickActions, sectionOptions, actionOptions, refinementSuggestions,
      runQuick, runGuided, runFree, keepChanges, revertChanges, runRefinement,
      originalSrc, pendingSrc, emit,
    };
  },
  template: `
    <div class="card" style="padding:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:13px;font-weight:600"><i class="fa-solid fa-wand-magic-sparkles" style="margin-right:6px"></i>AI assistant</span>
        <div style="display:flex;gap:2px" v-if="!pendingContent">
          <button @click="mode='quick'" :style="mode==='quick'?'background:var(--surface-raised);border:1px solid var(--border);border-radius:3px;padding:2px 6px;font-size:10px':'background:transparent;border:none;padding:2px 6px;font-size:10px;color:var(--ink-muted);cursor:pointer'">Quick</button>
          <button @click="mode='guided'" :style="mode==='guided'?'background:var(--surface-raised);border:1px solid var(--border);border-radius:3px;padding:2px 6px;font-size:10px':'background:transparent;border:none;padding:2px 6px;font-size:10px;color:var(--ink-muted);cursor:pointer'">Guided</button>
          <button @click="mode='free'" :style="mode==='free'?'background:var(--surface-raised);border:1px solid var(--border);border-radius:3px;padding:2px 6px;font-size:10px':'background:transparent;border:none;padding:2px 6px;font-size:10px;color:var(--ink-muted);cursor:pointer'">Free</button>
        </div>
      </div>

      <!-- Pending diff view (after AI generates, before keep/revert) -->
      <div v-if="pendingContent" style="margin-top:4px">
        <p style="font-size:11px;font-weight:600;margin:0 0 6px;color:var(--ink)">{{summary}}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px">
          <div>
            <p style="font-size:9px;color:var(--ink-muted);margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px">Before</p>
            <div style="height:120px;border:1px solid var(--border);border-radius:4px;overflow:hidden">
              <iframe :src="originalSrc" style="width:100%;height:100%;border:none" sandbox="allow-same-origin" scrolling="no"></iframe>
            </div>
          </div>
          <div>
            <p style="font-size:9px;color:var(--ink-muted);margin:0 0 2px;text-transform:uppercase;letter-spacing:0.5px">After</p>
            <div style="height:120px;border:1px solid var(--border);border-radius:4px;overflow:hidden">
              <iframe :src="pendingSrc" style="width:100%;height:100%;border:none" sandbox="allow-same-origin" scrolling="no"></iframe>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button class="btn btn-primary" @click="keepChanges" style="flex:1;font-size:11px;padding:6px"><i class="fa-solid fa-check"></i> Keep</button>
          <button class="btn btn-secondary" @click="revertChanges" style="flex:1;font-size:11px;padding:6px"><i class="fa-solid fa-rotate-left"></i> Revert</button>
        </div>
        <div v-if="refinementSuggestions.length" style="border-top:1px solid var(--border);padding-top:8px">
          <p style="font-size:10px;color:var(--ink-muted);margin:0 0 4px">Next steps:</p>
          <button v-for="s in refinementSuggestions" :key="s.label" @click="runRefinement(s)" style="display:block;width:100%;text-align:left;background:transparent;border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-size:11px;margin-bottom:3px;cursor:pointer;color:var(--ink)">
            <i class="fa-solid fa-arrow-right" style="font-size:8px;margin-right:4px;color:var(--ink-muted)"></i>{{s.label}}</button>
        </div>
      </div>

      <!-- Quick actions mode -->
      <div v-else-if="mode==='quick'" style="margin-top:4px">
        <p style="font-size:10px;color:var(--ink-muted);margin:0 0 6px">One-click improvements:</p>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          <button v-for="a in quickActions" :key="a.label" @click="runQuick(a)" :disabled="generating"
            style="display:flex;align-items:center;gap:4px;background:var(--surface-raised);border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-size:11px;cursor:pointer;color:var(--ink)">
            <i :class="'fa-solid '+a.icon" style="font-size:10px"></i>{{a.label}}</button>
        </div>
        <p v-if="generating" style="font-size:11px;color:var(--ink-muted);margin:8px 0 0"><i class="fa-solid fa-spinner fa-spin"></i> Generating…</p>
      </div>

      <!-- Guided edit mode -->
      <div v-else-if="mode==='guided'" style="margin-top:4px">
        <label class="field" style="margin:0 0 6px"><span style="font-size:10px">What do you want to change?</span>
          <select class="input" v-model="guided.action" style="font-size:11px;padding:4px 8px">
            <option value="">Select…</option>
            <option v-for="a in actionOptions" :key="a" :value="a">{{a}}</option>
          </select>
        </label>
        <label class="field" style="margin:0 0 6px"><span style="font-size:10px">Which section?</span>
          <select class="input" v-model="guided.section" style="font-size:11px;padding:4px 8px">
            <option value="">Select…</option>
            <option v-for="s in sectionOptions" :key="s" :value="s">{{s}}</option>
          </select>
        </label>
        <label class="field" style="margin:0 0 6px"><span style="font-size:10px">Details (optional)</span>
          <textarea class="input" v-model="guided.detail" rows="2" style="font-size:11px" placeholder="e.g. make it dark blue with white text"></textarea>
        </label>
        <button class="btn btn-primary" @click="runGuided" :disabled="generating||!guided.action||!guided.section" style="width:100%;font-size:11px;padding:6px">
          <i class="fa-solid fa-wand-magic-sparkles"></i> {{generating?'Thinking…':'Apply change'}}</button>
      </div>

      <!-- Free-text mode -->
      <div v-else style="margin-top:4px">
        <textarea class="input" v-model="aiPrompt" rows="3" style="font-size:12px" placeholder="Describe the changes you want in plain English…" @keyup.ctrl.enter="runFree"></textarea>
        <button class="btn btn-primary" @click="runFree" :disabled="generating||!aiPrompt.trim()" style="width:100%;margin-top:6px;font-size:12px">
          <i class="fa-solid fa-wand-magic-sparkles"></i> {{generating?'Thinking…':'Apply changes'}}</button>
      </div>
    </div>`,
});
