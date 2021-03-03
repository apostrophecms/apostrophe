/*
 * Provides:
 *
 * 1. A scaffold for modeling the doc or doc-like object in the editor,
 *   in the form of the docFields data attribute
 * 2. A scaffold for managing server side errors, in the form of the
 *   serverErrors data attribute and the handleSaveError method
 * 3. A scaffold for handling `following` in field definitios, via
 *   the `followingValues` method
 *
 * This mixin is designed to accommodate extension by components like
 *   AposDocEditor that split the UI into several AposSchemas.
 */

export default {
  data() {
    return {
      docFields: {
        data: {},
        hasErrors: false
      },
      serverErrors: null
    };
  },

  methods: {
    // followedBy is either "other" or "utility". The returned object contains
    // properties named for each field that follows other fields. For instance if followedBy is "utility"
    // then in our default configuration `followingValues` will be `{ slug: { title: 'latest title here' } }`
    followingValues(followedBy) {
      let fields;

      if (followedBy) {
        fields = (followedBy === 'other')
          ? this.schema.filter(field => !this.utilityFields.includes(field.name)) : this.schema.filter(field => this.utilityFields.includes(field.name));
      } else {
        fields = this.schema;
      }

      const followingValues = {};

      for (const field of fields) {
        if (field.following) {
          const following = Array.isArray(field.following) ? field.following : [ field.following ];
          followingValues[field.name] = {};
          for (const name of following) {
            followingValues[field.name][name] = this.getFieldValue(name);
          }
        }
      }
      return followingValues;
    },
    // Overridden by components that split the fields into several AposSchemas
    getFieldValue(name) {
      return this.docFields.data[name];
    },
    // Simple parents only have one AposSchema object.
    // Complex parents like ApocDocEditor can override
    // to return the appropriate ref
    getAposSchema(field) {
      return this.$refs.schema;
    },
    // Handle a server-side save error, attaching it to the right field
    // in the schema. fallback is a fallback error message, if none is provided
    // by the server.
    async handleSaveError(e, { fallback }) {
      if (e.body && e.body.data && e.body.data.errors) {
        const serverErrors = {};
        let first;
        e.body.data.errors.forEach(e => {
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
