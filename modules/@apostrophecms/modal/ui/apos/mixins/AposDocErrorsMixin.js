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
    }
  }
};
