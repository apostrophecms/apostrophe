export default {
  name: 'AposSettingsManager',
  emits: [ 'safe-close', 'modal-result' ],
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
      busy: false
      // TODO updated state (changed with timeOut) when save is successful,
      // sent to the Subform component.
      // updatedState: false
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
  methods: {
    close() {
      this.modal.showModal = false;
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
      } catch (e) {
        await this.handleSaveError(e, {
          fallback: this.$t('apos-signup:error')
        });
      } finally {
        this.busy = false;
        // FIXME here for testing reasons, remove in the next ticket.
        // setTimeout(() => {
        //   this.busy = false;
        // }, 1000);
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
