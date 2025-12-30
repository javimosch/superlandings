# Frontend modularization plan

## Goals
- Cap files around 300–500 LOC to keep them readable and testable.
- Separate concerns: state, services (API), UI controllers, and helpers.
- Avoid build steps; keep inline scripts/partials consistent with current stack (Vue 3 global, Tailwind CDN, CodeMirror).
- Minimize churn: migrate in batches so manual testing can happen between steps.

## Target structure
```
views/admin/partials/
  app-root.ejs            # createApp, compose modules, mount
  state.js                # reactive state factory (flags, collections, editors)
  helpers.js              # headers builder, icon init, shared utilities
  services/
    auth.js
    organizations.js
    landings.js
    domains.js
    versions.js
    audit.js
    cloudflare.js
  modules/
    landings.js           # landing CRUD, editor init/teardown
    domains.js            # publish/unpublish, domains modal
    versions.js           # versions modal, diff/preview
    audit.js              # audit modal pagination
    organizations.js      # org switcher, user rights modal
    cloudflare.js         # status/recap
    toasts.js             # DOM-based toast renderer
```

## Batch plan
1) **Doc + skeleton (this doc)**  
   - Document plan (done).  
   - Prepare to split scripts without logic change.

2) **Batch 1: extract scaffolding**  
   - Create `helpers.js` (headers builder, toast/icon helpers stubs).  
   - Create `services/*` with fetch wrappers mirroring existing endpoints.  
   - Create `state.js` factory for all reactive data/defaults.  
   - Create `app-root.ejs` that composes modules; temporarily keep logic in root but call services/helpers.  
   - Update `index.ejs` to include new partials instead of monolithic `scripts.ejs`.  
   - Goal: no behavior change.

3) **Batch 2: landing + toasts**  
   - Move landing CRUD, editor init, modals into `modules/landings.js`.  
   - Move toast DOM code into `modules/toasts.js`; expose `addToast/removeToast` to rest.  
   - Root wires module methods into Vue instance.

4) **Batch 3: domains & publishing**  
   - Extract domains modal logic and publish/unpublish actions into `modules/domains.js`.

5) **Batch 4: versions & audit**  
   - Extract versions modal/diff/preview/rollback into `modules/versions.js`.  
   - Extract audit modal pagination and before/after links into `modules/audit.js`.

6) **Batch 5: organizations & cloudflare**  
   - Extract org switcher/CRUD/user rights into `modules/organizations.js`.  
   - Extract cloudflare status/recap into `modules/cloudflare.js`.

7) **Cleanup + guardrails**  
   - Verify each file ≤500 LOC; split further if needed.  
   - Keep shared helpers small; avoid circular deps.  
   - Add inline comments only for non-obvious bits (e.g., toast DOM rendering).  
   - Retire old `partials/scripts.ejs` after all moves.

## Conventions
- Services: plain functions returning data or throwing on HTTP errors; shared `buildHeaders(currentOrg)` adds `X-Organization-Id`.  
- Modules: factory `(state, services, helpers) => methods` so root can `Object.assign(appConfig.methods, moduleMethods)`.  
- Editors: init/teardown lives in landing module to avoid cross-module refs.  
- Icons/toasts: DOM-driven to prevent Vue patch conflicts; initialize after mount.  
- Testing cadence: user manually tests after each batch; we keep diffs small.
