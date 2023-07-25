export default {
  name: 'AposSettingsManager',
  emits: [ 'safe-close' ],
  data() {
    return {
      modal: {
        busy: false,
        active: false,
        showModal: false
      },
      values: {
        data: {}
      },
      docReady: false,
      // Object same as serverErrors (AposEditorMixin)
      errors: null,
      busy: false,
      preview: true,
      updateTimeout: null
    };
  },
  computed: {
    moduleOptions() {
      return apos.settings;
    },
    action() {
      return this.moduleOptions.action;
    },
    subforms() {
      return this.moduleOptions.subforms;
    }
  },
  async mounted() {
    this.modal.active = true;
    await this.loadData();
  },
  beforeDestroy() {
    clearTimeout(this.updateTimeout);
  },
  methods: {
    close() {
      this.modal.showModal = false;
    },
    updatePreview(event) {
      this.preview = event;
      if (!event) {
        clearTimeout(this.updateTimeout);
        this.updateTimeout = null;
      }
    },
    async submit(event) {
      this.errors = null;
      this.busy = true;
      try {
        const values = await apos.http.patch(
            `${this.action}/${event.name}`,
            {
              busy: false,
              body: event.values
            }
        );
        this.values.data[event.name] = values;
        this.updateTimeout = setTimeout(() => {
          this.updateTimeout = null;
        }, 3000);
        this.updatePreview(true);
      } catch (e) {
        await this.handleSaveError(e, {
          fallback: this.$t('apostrophe:error')
        });
      } finally {
        this.busy = false;
      }
    },
    async loadData() {
      const result = await apos.http.get(this.action, {
        busy: true
      });

      this.setSubformValues(result);
      this.docReady = true;
    },
    setSubformValues(values) {
      const newValues = {};
      for (const subform of this.subforms) {
        newValues[subform.name] = {};
        for (const field of subform.schema) {
          newValues[subform.name][field.name] = values[field.name];
        }
      }
      this.values.data = newValues;
    },
    async handleSaveError(e, { fallback }) {
      console.error(e);
      if (e.body && e.body.data && e.body.data.errors) {
        const serverErrors = {};
        let first;
        e.body.data.errors.forEach(e => {
          first = first || e;
          serverErrors[e.path] = e;
        });
        this.errors = serverErrors;
      } else {
        await apos.notify((e.body && e.body.message) || fallback, {
          type: 'danger',
          icon: 'alert-circle-icon',
          dismiss: true
        });
      }
    }
  }
};
