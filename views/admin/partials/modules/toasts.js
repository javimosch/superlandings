<script>
  (function () {
    function toastsModule() {
      return {
        initToastStore() {
          if (!this.toastStore) this.toastStore = [];
        },
        async addToast(type, message, duration = 5000) {
          if (!this.isMounted) return;
          this.initToastStore();
          await this.$nextTick();
          const id = String(++this.toastId);
          const toast = { id, type, message };
          this.toastStore.push(toast);
          this.$nextTick(() => this.renderToasts());
          setTimeout(() => this.removeToast(id), duration);
        },
        async removeToast(id) {
          if (!this.isMounted || !this.toastStore) return;
          await this.$nextTick();
          this.toastStore = this.toastStore.filter(t => t.id !== id);
          this.$nextTick(() => this.renderToasts());
        },
        renderToasts() {
          const root = document.getElementById('toast-root');
          if (!root) return;
          root.innerHTML = '';
          const frag = document.createDocumentFragment();
          const list = (this.toastStore || []).slice(-3);
          list.forEach((toast) => {
            const wrapper = document.createElement('div');
            wrapper.className = `px-6 py-4 rounded-lg shadow-lg max-w-md toast-enter text-white ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`;
            wrapper.innerHTML = `
              <div class="flex items-start">
                ${toast.type === 'error'
                  ? '<svg class="w-6 h-6 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
                  : '<svg class="w-6 h-6 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'}
                <div class="flex-1">${toast.message}</div>
                <button data-id="${toast.id}" class="ml-4 text-white/80 hover:text-white pointer-events-auto">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            `;
            wrapper.querySelector('button')?.addEventListener('click', () => this.removeToast(toast.id));
            frag.appendChild(wrapper);
          });
          root.appendChild(frag);
        },
        showError(message) { this.addToast('error', message); },
        showSuccess(message) { this.addToast('success', message, 3000); },
      };
    }

    window.AppModules = window.AppModules || {};
    window.AppModules.toasts = toastsModule;
  })();
</script>
