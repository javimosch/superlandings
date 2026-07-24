/* Block editor component — visual no-code editor for non-technical users
   Props: blockData (array), landing (object)
   Emits: 'save' (compiledHtml, blockData), 'toast' (msg, type) */
app.component('block-editor', {
  props: ['blockData', 'landing'],
  emits: ['save', 'toast'],
  setup(props, { emit }) {
    // Local aliases for window globals so the template doesn't reference window directly
    const SL_BLOCKS = window.SL_BLOCKS;
    const SL_BLOCK_GET = window.SL_BLOCK_GET;
    const SL_BLOCK_DEFAULTS = window.SL_BLOCK_DEFAULTS;
    const SL_COMPILE = window.SL_COMPILE;

    const blocks = ref(JSON.parse(JSON.stringify(props.blockData || [])));
    const selectedIdx = ref(null);
    const showPicker = ref(false);
    const dirty = ref(false);
    const widePreview = ref(false);
    const previewFrame = { current: null }; // non-reactive container so template ref function can set it
    const savedScroll = ref({ top: 0, left: 0 });
    let dragSrcIdx = null;

    // Group blocks by category for picker
    const blocksByCategory = computed(() => {
      const cats = {};
      for (const b of SL_BLOCKS) {
        if (!cats[b.category]) cats[b.category] = [];
        cats[b.category].push(b);
      }
      return cats;
    });

    const selectedBlock = computed(() => {
      if (selectedIdx.value === null || selectedIdx.value < 0 || selectedIdx.value >= blocks.value.length) return null;
      return blocks.value[selectedIdx.value];
    });

    const selectedDef = computed(() => {
      if (!selectedBlock.value) return null;
      return SL_BLOCK_GET(selectedBlock.value.type);
    });

    // Live preview HTML (used for "open in new tab" and full reloads)
    const previewHtml = computed(() => SL_COMPILE(blocks.value));

    // Manual preview control to avoid full iframe reloads when only order changes.
    const iframeSrc = ref('');
    let lastPreviewBlocks = JSON.parse(JSON.stringify(blocks.value || []));
    let pendingBlocks = null;
    let previewLoaded = false;

    const blockJson = (b) => JSON.stringify({ type: b.type, props: b.props });
    const isReorder = (a, b) => {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
      const aStr = a.map(blockJson).sort();
      const bStr = b.map(blockJson).sort();
      return JSON.stringify(aStr) === JSON.stringify(bStr);
    };

    const captureScroll = () => {
      const win = previewFrame.current?.contentWindow;
      if (!win) return;
      const doc = win.document;
      const top = win.scrollY || doc?.documentElement?.scrollTop || doc?.body?.scrollTop || 0;
      const left = win.scrollX || doc?.documentElement?.scrollLeft || doc?.body?.scrollLeft || 0;
      savedScroll.value = { top, left };
    };

    const restoreScroll = () => {
      const win = previewFrame.current?.contentWindow;
      if (!win) return;
      const doc = win.document;
      const doRestore = () => {
        win.scrollTo(savedScroll.value.left, savedScroll.value.top);
        if (doc) {
          doc.documentElement.scrollTop = savedScroll.value.top;
          doc.documentElement.scrollLeft = savedScroll.value.left;
          doc.body.scrollTop = savedScroll.value.top;
          doc.body.scrollLeft = savedScroll.value.left;
        }
      };
      if (win.requestAnimationFrame) {
        win.requestAnimationFrame(() => win.requestAnimationFrame(doRestore));
      } else {
        setTimeout(doRestore, 0);
      }
    };

    const reorderPreview = (current) => {
      const win = previewFrame.current?.contentWindow;
      const body = win?.document?.body;
      if (!body) return;
      const nodes = Array.from(body.querySelectorAll('[data-sl-block-idx]'));
      if (!nodes.length) return;
      const nodeByIdx = {};
      nodes.forEach((n) => { nodeByIdx[n.getAttribute('data-sl-block-idx')] = n; });
      const used = new Set();
      captureScroll();
      for (const block of current) {
        const j = lastPreviewBlocks.findIndex((b, idx) => !used.has(idx) && blockJson(b) === blockJson(block));
        if (j === -1) continue;
        const node = nodeByIdx[j];
        if (node) { used.add(j); body.appendChild(node); }
      }
      // Re-index nodes so the next reorder maps against the new order
      Array.from(body.querySelectorAll('[data-sl-block-idx]')).forEach((n, idx) => n.setAttribute('data-sl-block-idx', idx));
      restoreScroll();
    };

    const renderPreview = () => {
      if (!previewFrame.current) return;
      const current = JSON.parse(JSON.stringify(blocks.value || []));
      if (JSON.stringify(current) === JSON.stringify(lastPreviewBlocks)) return;
      if (previewLoaded && isReorder(current, lastPreviewBlocks)) {
        reorderPreview(current);
        lastPreviewBlocks = current;
      } else {
        pendingBlocks = current;
        previewLoaded = false;
        captureScroll();
        iframeSrc.value = previewHtml.value;
      }
    };

    const onPreviewLoad = (e) => {
      if (e?.target) previewFrame.current = e.target;
      if (pendingBlocks) {
        lastPreviewBlocks = pendingBlocks;
        pendingBlocks = null;
      }
      previewLoaded = true;
      restoreScroll();
    };

    Vue.watch(blocks, renderPreview, { deep: true, flush: 'post' });
    Vue.onMounted(() => {
      pendingBlocks = JSON.parse(JSON.stringify(blocks.value || []));
      iframeSrc.value = previewHtml.value;
    });

    const markDirty = () => { dirty.value = true; };

    // Add a block from the picker
    const addBlock = (type) => {
      const def = SL_BLOCK_GET(type);
      if (!def) return;
      blocks.value.push({ type, props: SL_BLOCK_DEFAULTS(type) });
      selectedIdx.value = blocks.value.length - 1;
      showPicker.value = false;
      markDirty();
    };

    // Remove a block
    const removeBlock = (idx) => {
      blocks.value.splice(idx, 1);
      if (selectedIdx.value === idx) selectedIdx.value = null;
      else if (selectedIdx.value !== null && selectedIdx.value > idx) selectedIdx.value--;
      markDirty();
    };

    // Duplicate a block
    const duplicateBlock = (idx) => {
      const copy = JSON.parse(JSON.stringify(blocks.value[idx]));
      const def = SL_BLOCK_GET(copy.type);
      const base = copy.name || (def ? def.label : copy.type);
      copy.name = base + ' copy';
      blocks.value.splice(idx + 1, 0, copy);
      selectedIdx.value = idx + 1;
      markDirty();
    };

    // Move block up/down
    const moveBlock = (idx, dir) => {
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= blocks.value.length) return;
      const tmp = blocks.value[idx];
      blocks.value[idx] = blocks.value[newIdx];
      blocks.value[newIdx] = tmp;
      if (selectedIdx.value === idx) selectedIdx.value = newIdx;
      else if (selectedIdx.value === newIdx) selectedIdx.value = idx;
      markDirty();
    };

    // Drag-and-drop reorder
    const onDragStart = (idx) => { dragSrcIdx = idx; };
    const onDragOver = (e, idx) => { e.preventDefault(); };
    const onDrop = (idx) => {
      if (dragSrcIdx === null || dragSrcIdx === idx) return;
      const moved = blocks.value.splice(dragSrcIdx, 1)[0];
      blocks.value.splice(idx, 0, moved);
      if (selectedIdx.value === dragSrcIdx) selectedIdx.value = idx;
      dragSrcIdx = null;
      markDirty();
    };

    // Update a prop on the selected block
    const updateProp = (key, value) => {
      if (!selectedBlock.value) return;
      selectedBlock.value.props[key] = value;
      markDirty();
    };

    // Update the custom name of any block (name is metadata; not used for rendering)
    const updateBlockName = (idx, value) => {
      const v = value.trim();
      if (v) blocks.value[idx].name = v;
      else delete blocks.value[idx].name;
      markDirty();
    };

    // List item operations (for list-type props)
    const addListItem = (key) => {
      if (!selectedBlock.value) return;
      const list = selectedBlock.value.props[key];
      if (!Array.isArray(list)) return;
      // Create a blank item based on existing structure
      const sample = list[0] || {};
      const newItem = {};
      for (const k of Object.keys(sample)) newItem[k] = '';
      list.push(newItem);
      markDirty();
    };
    const removeListItem = (key, idx) => {
      if (!selectedBlock.value) return;
      selectedBlock.value.props[key].splice(idx, 1);
      markDirty();
    };
    const updateListItem = (key, idx, itemKey, value) => {
      if (!selectedBlock.value) return;
      selectedBlock.value.props[key][idx][itemKey] = value;
      markDirty();
    };

    // Save — compile blocks to HTML and emit
    const save = () => {
      const html = SL_COMPILE(blocks.value);
      emit('save', html, JSON.parse(JSON.stringify(blocks.value)));
      dirty.value = false;
    };

    // Open preview in new tab
    const openPreviewTab = () => {
      const w = window.open('', '_blank');
      w.document.write(previewHtml.value); w.document.close();
    };

    return {
      blocks, selectedIdx, selectedBlock, selectedDef, showPicker, dirty, widePreview,
      blocksByCategory, previewFrame, iframeSrc,
      addBlock, removeBlock, duplicateBlock, moveBlock,
      onDragStart, onDragOver, onDrop,
      updateProp, updateBlockName, addListItem, removeListItem, updateListItem,
      save, openPreviewTab, onPreviewLoad, markDirty, emit,
      // expose helper for template
      getBlock: SL_BLOCK_GET,
    };
  },
  template: `
    <div style="display:flex;gap:12px;height:calc(100vh - 80px);align-items:stretch">

      <!-- Left sidebar: block list + add button -->
      <div v-if="!widePreview" style="width:240px;flex-shrink:0;display:flex;flex-direction:column;gap:8px;overflow-y:auto;padding-right:4px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:13px;font-weight:600">Blocks</span>
          <span v-if="dirty" class="tag tag-yellow" style="font-size:9px">Unsaved</span>
        </div>

        <div v-if="blocks.length===0" class="card" style="padding:20px;text-align:center">
          <i class="fa-solid fa-cubes" style="font-size:24px;color:var(--ink-faint);margin-bottom:8px"></i>
          <p class="text-muted" style="font-size:12px;margin:0 0 12px">No blocks yet. Add your first block to start building.</p>
        </div>

        <!-- Block list -->
        <div v-for="(b,idx) in blocks" :key="idx"
          draggable="true" @dragstart="onDragStart(idx)" @dragover="onDragOver($event,idx)" @drop="onDrop(idx)"
          @click="selectedIdx=idx"
          :style="selectedIdx===idx?'background:var(--surface-raised);border:2px solid var(--accent);border-radius:6px;padding:8px 10px;cursor:pointer':'background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px 10px;cursor:pointer'">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">
            <div style="display:flex;align-items:flex-start;gap:6px;min-width:0;flex:1">
              <i class="fa-solid fa-grip-vertical" style="font-size:10px;color:var(--ink-faint);flex-shrink:0;margin-top:3px"></i>
              <i :class="'fa-solid '+(selectedDef&&blocks[idx]?getBlock(b.type)?.icon:'fa-cube')" style="font-size:11px;color:var(--ink-muted);flex-shrink:0;margin-top:3px"></i>
              <div style="display:flex;flex-direction:column;min-width:0;flex:1">
                <input :value="b.name" @input="updateBlockName(idx, $event.target.value)" :placeholder="getBlock(b.type)?.label || b.type"
                  style="background:transparent;border:none;border-bottom:1px solid var(--border);padding:0;font-size:12px;font-weight:500;color:var(--ink);width:100%;min-width:0;outline:none"
                  @focus="$event.target.style.borderBottomColor='var(--accent)'" @blur="$event.target.style.borderBottomColor='var(--border)'">
                <span style="font-size:10px;color:var(--ink-muted);line-height:1.4">{{getBlock(b.type)?.label || b.type}}</span>
              </div>
            </div>
            <div @click.stop style="display:flex;gap:1px;flex-shrink:0;margin-top:2px">
              <button class="btn btn-ghost" @click="moveBlock(idx,-1)" :disabled="idx===0" style="padding:2px 4px;font-size:10px" title="Move up"><i class="fa-solid fa-chevron-up"></i></button>
              <button class="btn btn-ghost" @click="moveBlock(idx,1)" :disabled="idx===blocks.length-1" style="padding:2px 4px;font-size:10px" title="Move down"><i class="fa-solid fa-chevron-down"></i></button>
              <button class="btn btn-ghost" @click="removeBlock(idx)" style="padding:2px 6px;font-size:10px;color:var(--pastel-red-fg)" title="Remove block"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        </div>

        <button class="btn btn-secondary" @click="showPicker=true" style="width:100%;font-size:12px;margin-top:4px">
          <i class="fa-solid fa-plus"></i> Add block</button>

        <button v-if="blocks.length>0" class="btn btn-primary" @click="save" :disabled="!dirty" style="width:100%;font-size:12px;margin-top:4px">
          <i class="fa-solid fa-floppy-disk"></i> {{dirty?'Save page':'Saved'}}</button>
      </div>

      <!-- Middle: inline edit form (when a block is selected) -->
      <div v-if="!widePreview && selectedBlock && selectedDef" style="width:280px;flex-shrink:0;overflow-y:auto;padding-right:4px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;gap:8px">
          <div style="display:flex;flex-direction:column;min-width:0;flex:1">
            <input :value="selectedBlock.name" @input="updateBlockName(selectedIdx, $event.target.value)" :placeholder="selectedDef.label"
              style="background:transparent;border:none;border-bottom:1px solid var(--border);padding:0;font-size:13px;font-weight:600;color:var(--ink);width:100%;min-width:0;outline:none"
              @focus="$event.target.style.borderBottomColor='var(--accent)'" @blur="$event.target.style.borderBottomColor='var(--border)'">
            <span style="font-size:10px;color:var(--ink-muted);line-height:1.4">{{selectedDef.label}}</span>
          </div>
          <div style="display:flex;gap:2px;flex-shrink:0;margin-top:2px">
            <button class="btn btn-ghost" @click="duplicateBlock(selectedIdx)" title="Duplicate" style="padding:4px 8px;font-size:11px"><i class="fa-solid fa-copy"></i></button>
            <button class="btn btn-ghost" @click="removeBlock(selectedIdx)" title="Delete" style="padding:4px 8px;font-size:11px;color:var(--pastel-red-fg)"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>

        <!-- Prop fields -->
        <div v-for="f in selectedDef.props" :key="f.key" style="margin-bottom:10px">
          <!-- Text / color input -->
          <label v-if="f.type==='text'||f.type==='color'" class="field" style="margin:0">
            <span style="font-size:11px">{{f.label}}</span>
            <input class="input" :type="f.type" :value="selectedBlock.props[f.key]" @input="updateProp(f.key, $event.target.value)" style="font-size:12px" :style="f.type==='color'?'height:32px;padding:2px':''">
          </label>

          <!-- Textarea -->
          <label v-else-if="f.type==='textarea'" class="field" style="margin:0">
            <span style="font-size:11px">{{f.label}}</span>
            <textarea class="input" :value="selectedBlock.props[f.key]" @input="updateProp(f.key, $event.target.value)" rows="4" style="font-size:12px"></textarea>
          </label>

          <!-- Select -->
          <label v-else-if="f.type==='select'" class="field" style="margin:0">
            <span style="font-size:11px">{{f.label}}</span>
            <select class="input" :value="selectedBlock.props[f.key]" @change="updateProp(f.key, $event.target.value)" style="font-size:12px">
              <option v-for="opt in f.options" :key="opt" :value="opt">{{opt}}</option>
            </select>
          </label>

          <!-- List (array of objects) -->
          <div v-else-if="f.type==='list'">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:11px;font-weight:600">{{f.label}}</span>
              <button class="btn btn-ghost" @click="addListItem(f.key)" style="padding:2px 6px;font-size:10px"><i class="fa-solid fa-plus"></i></button>
            </div>
            <div v-for="(item,idx) in selectedBlock.props[f.key]" :key="idx" class="card-flat" style="padding:8px;margin-bottom:6px">
              <div v-for="itemKey in Object.keys(item)" :key="itemKey" style="margin-bottom:4px">
                <label class="field" style="margin:0">
                  <span style="font-size:10px;text-transform:capitalize">{{itemKey}}</span>
                  <input class="input" :value="item[itemKey]" @input="updateListItem(f.key, idx, itemKey, $event.target.value)" style="font-size:11px;padding:4px 8px">
                </label>
              </div>
              <button class="btn btn-ghost" @click="removeListItem(f.key, idx)" style="padding:2px 6px;font-size:10px;color:var(--pastel-red-fg);margin-top:2px"><i class="fa-solid fa-trash"></i> Remove</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: live preview -->
      <div style="flex:1;display:flex;flex-direction:column;min-width:0">
        <div style="display:flex;align-items:center;gap:0;border-bottom:1px solid var(--border);flex-shrink:0">
          <span style="padding:8px 16px;font-weight:500;font-size:13px"><i class="fa-solid fa-eye"></i> Preview</span>
          <div style="flex:1"></div>
          <button class="btn btn-ghost" @click="widePreview=!widePreview" :title="widePreview?'Show sidebars':'Hide sidebars for wider preview'" style="margin:4px 0;font-size:12px">
            <i class="fa-solid" :class="widePreview?'fa-compress':'fa-expand'"></i> {{widePreview?'Collapse':'Expand'}}
          </button>
          <button class="btn btn-ghost" @click="openPreviewTab" style="margin:4px 0;font-size:12px"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open in new tab</button>
        </div>
        <div style="flex:1;border:1px solid var(--border);border-top:none;border-radius:0 0 6px 6px;overflow:hidden">
          <iframe :ref="(el)=>{ if (el && previewFrame) previewFrame.current = el }" :srcdoc="iframeSrc" @load="onPreviewLoad" style="width:100%;height:100%;border:none" sandbox="allow-same-origin allow-scripts allow-popups"></iframe>
        </div>
      </div>

      <!-- Block picker modal -->
      <div v-if="showPicker" class="modal-overlay" @click="showPicker=false">
        <div class="modal" @click.stop style="max-width:500px">
          <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <h3 class="font-serif" style="font-size:18px;margin:0">Add a block</h3>
            <button class="btn btn-ghost" @click="showPicker=false" style="padding:4px 8px"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div style="padding:20px;max-height:400px;overflow-y:auto">
            <div v-for="(catBlocks, cat) in blocksByCategory" :key="cat" style="margin-bottom:16px">
              <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--ink-muted);margin:0 0 8px">{{cat}}</h4>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">
                <button v-for="b in catBlocks" :key="b.type" @click="addBlock(b.type)"
                  style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 8px;background:var(--surface);border:1px solid var(--border);border-radius:8px;cursor:pointer;text-align:center">
                  <i :class="'fa-solid '+b.icon" style="font-size:20px;color:var(--ink-muted)"></i>
                  <span style="font-size:11px;font-weight:500">{{b.label}}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`,
});
