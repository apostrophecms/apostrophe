// Provide basic bridging functionality between tabs
// and the modal body.

export default {
  data() {
    return {
      serverErrors: null
    };
  },

  methods: {
    // followedBy is either "other" or "utility". The returned object contains
    // properties named for each field that follows another field; the values are
    // those of the followed field. For instance if followedBy is "utility"
    // then in our default configuration `followingValues` will be `{ slug: 'latest title here' }`
    followingValues: function(followedBy) {
      let fields;
      let source;

      if (followedBy) {
        fields = (followedBy === 'other')
          ? this.schema.filter(field => !this.utilityFields.includes(field.name)) : this.schema.filter(field => this.utilityFields.includes(field.name));

        source = (followedBy === 'other') ? this.docUtilityFields
          : this.docOtherFields;
      } else {
        fields = this.schema;
        source = this.doc;
      }

      const followingValues = {};

      for (const field of fields) {
        if (field.following) {
          followingValues[field.name] = source.data[field.following];
        }
      }

      return followingValues;
    },
    // Simple parents only have one AposSchema object.
    // Complex parents like ApocDocEditor can override
    // to return the appropriate ref
    getAposSchema(field) {
      return this.$refs.schema;
    },
    async handleSaveError(e, { fallback }) {
      if (e.body && e.body.data && e.body.data.errors) {
        const serverErrors = {};
        let first;
        e.body.data.errors.map(e => {
          first = first || e;
          serverErrors[e.path] = e;
        });
        this.serverErrors = serverErrors;
        if (first) {
          const field = this.schema.find(field => field.name === first.path);
          if (field) {
            if ((field.group.name !== 'utility') && (this.switchPane)) {
              this.switchPane(field.group.name);
            }
            // Let pane switching effects settle first
            this.$nextTick(() => {
              this.getAposSchema(field).scrollFieldIntoView(field.name);
            });
          }
        }
      } else {
        await self.apos.notify((e.body && e.body.message) || fallback, {
          type: 'danger',
          icon: 'alert-circle-icon',
          dismiss: true
        });
      }
    }
  }
};
