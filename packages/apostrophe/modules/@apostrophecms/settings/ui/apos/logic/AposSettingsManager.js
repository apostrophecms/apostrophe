export default {
  name: 'AposSettingsManager',
  props: {
    restore: {
      type: String,
      default: null
    }
  },
  data() {
    return {
      modal: {
        busy: false,
        active: false,
        showModal: false,
        type: 'overlay'
      },
      values: {
        data: {}
      },
      docReady: false,
      // Object same as serverErrors (AposEditorMixin)
      errors: null,
      busy: false,
      expanded: null,
      subformUpdateTimeouts: {},
      activeGroup: null,
      restoreRefTimeout: null
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
    },
    groups() {
      const groupSet = {};

      this.subforms.forEach(subform => {
        if (subform.group && !groupSet[subform.group.name]) {
          groupSet[subform.group.name] = {
            name: subform.group.name,
            label: subform.group.label,
            index: [ subform.name ],
            subforms: [ subform ]
          };
        } else if (subform.group) {
          groupSet[subform.group.name].index.push(subform.name);
          groupSet[subform.group.name].subforms.push(subform);
        }
      });

      return groupSet;
    }
  },
  async mounted() {
    if (!this.activeGroup) {
      this.activeGroup = Object.keys(this.groups)[0];
    }
    this.modal.active = true;
    await this.loadData();

    if (this.restore) {
      const subform = this.subforms
        .find(subform => subform.name === this.restore);
      this.activeGroup = subform?.group?.name;
      if (this.activeGroup) {
        this.restoreRefTimeout = setTimeout(() => {
          this.$refs[subform.name]?.[0]?.scrollIntoView();
        }, 1000);
        this.setUpdatedTimeout(this.restore, 5000);
      }
    }
  },
  beforeUnmount() {
    clearTimeout(this.restoreRefTimeout);
    Object.values(this.subformUpdateTimeouts)
      .forEach(clearTimeout);
  },
  methods: {
    close() {
      this.modal.showModal = false;
    },
    updateExpanded(event) {
      this.expanded = event.value ? event.name : null;
      if (this.expanded) {
        clearTimeout(this.subformUpdateTimeouts[event.name]);
        delete this.setSubformValues[event.name];
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
        this.setUpdatedTimeout(event.name);
        this.updateExpanded({
          name: event.name,
          value: false
        });
        // Reload
        const subform = this.subforms.find(subform => subform.name === event.name);
        if (subform?.reload) {
          window.location.reload();
        }
      } catch (e) {
        await this.handleSaveError(e, {
          fallback: this.$t('apostrophe:error')
        });
      } finally {
        this.busy = false;
      }
    },
    setUpdatedTimeout(name, ms = 3000) {
      const updateTimeout = setTimeout(() => {
        delete this.subformUpdateTimeouts[name];
      }, ms);
      this.subformUpdateTimeouts[name] = updateTimeout;
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
      // eslint-disable-next-line no-console
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
