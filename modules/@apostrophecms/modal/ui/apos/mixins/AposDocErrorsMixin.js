import cuid from 'cuid';

export default {
  data: () => ({
    fieldErrors: {},
    errorCount: 0

  }),
  mounted () {
    this.prepErrors();
  },
  computed: {
    errorTooltip() {
      return this.errorCount
        ? {
          key: 'apostrophe:errorCount',
          count: this.errorCount
        } : null;
    }
  },
  methods: {
    updateFieldErrors(fieldState) {
      this.tabKey = cuid();
      for (const key in this.groups) {
        this.groups[key].fields.forEach(field => {
          if (fieldState[field]) {
            this.fieldErrors[key][field] = fieldState[field].error;
          }
        });
      }
      this.updateErrorCount();
    },
    updateErrorCount() {
      let count = 0;
      for (const key in this.fieldErrors) {
        for (const errKey in this.fieldErrors[key]) {
          if (this.fieldErrors[key][errKey]) {
            count++;
          }
        }
      }
      this.errorCount = count;
    },
    prepErrors() {
      this.fieldErrors = Object.keys(this.groups).reduce((acc, name) => {
        return {
          ...acc,
          [name]: {}
        };
      }, {});
    },
    focusNextError() {
      let field;
      for (const key in this.fieldErrors) {
        for (const errKey in this.fieldErrors[key]) {
          if (this.fieldErrors[key][errKey] && !field) {
            field = this.schema.filter(item => {
              return item.name === errKey;
            })[0];

            if (field.group.name !== 'utility') {
              this.switchPane(field.group.name);
            }

            this.getAposSchema(field).scrollFieldIntoView(field.name);
          }
        }
      }
    },

    getAposSchema(field) {
      if (field.group.name === 'utility') {
        return this.$refs.utilitySchema;
      } else {
        return this.$refs[field.group.name][0];
      }
    }
  }
};
