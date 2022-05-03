/*
 * Provides:
 *
 * 1. A scaffold for modeling the doc or doc-like object in the editor,
 *   in the form of the docFields data attribute
 * 2. A scaffold for managing server side errors, in the form of the
 *   serverErrors data attribute and the handleSaveError method
 * 3. A scaffold for handling `following` in field definitions, via
 *   the `followingValues` method
 * 4. A scaffold for handling conditional fields, via the
 *   `conditionalFields` method
 *
 * This mixin is designed to accommodate extension by components like
 *   AposDocEditor that split the UI into several AposSchemas.
 */

import { klona } from 'klona';

export default {
  data() {
    return {
      docFields: {
        data: {}
      },
      serverErrors: null,
      restoreOnly: false,
      changed: []
    };
  },

  computed: {
    schema() {
      let schema = (this.moduleOptions.schema || []).filter(field => apos.schema.components.fields[field.type]);
      if (this.restoreOnly) {
        schema = klona(schema);
        for (const field of schema) {
          field.readOnly = true;
        }
      }
      // Archive UI is handled via action buttons
      schema = schema.filter(field => field.name !== 'archived');
      return schema;
    }
  },

  methods: {
    // followedByCategory may be falsy (all fields), "other" or "utility". The returned
    // object contains properties named for each field in that category that
    // follows other fields. For instance if followedBy is "utility" then in our
    // default configuration `followingValues` will be:
    //
    // `{ slug: { title: 'latest title here' } }`
    followingValues(followedByCategory) {
      const fields = this.getFieldsByCategory(followedByCategory);

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

    // Fetch the subset of the schema in the given category, either
    // 'utility' or 'other', or the entire schema if followedByCategory
    // is falsy
    getFieldsByCategory(followedByCategory) {
      if (followedByCategory) {
        return (followedByCategory === 'other')
          ? this.schema.filter(field => !this.utilityFields.includes(field.name))
          : this.schema.filter(field => this.utilityFields.includes(field.name));
      } else {
        return this.schema;
      }
    },

    // The returned object contains a property for each field that is
    // conditional on other fields, `true` if that field's conditions are
    // satisfied and `false` if they are not. There will be no properties for
    // fields that are not conditional.
    //
    // Any condition on a field that is itself conditional fails if the second
    // field's conditions fail.
    //
    // If present, followedByCategory must be either "other" or "utility", and
    // the returned object will contain properties only for conditional fields
    // in that category, although they may be conditional upon fields in either
    // category.

    conditionalFields(followedByCategory) {

      const self = this;
      const conditionalFields = {};

      while (true) {
        let change = false;
        for (const field of this.schema) {
          if (field.if) {
            const result = evaluate(field.if);
            const previous = conditionalFields[field.name];
            if (previous !== result) {
              change = true;
            }
            conditionalFields[field.name] = result;
          }
        }
        if (!change) {
          break;
        }
      }

      const fields = this.getFieldsByCategory(followedByCategory);
      const result = {};
      for (const field of fields) {
        if (field.if) {
          result[field.name] = conditionalFields[field.name];
        }
      }
      return result;

      function evaluate(clause) {
        let result = true;
        for (const [ key, val ] of Object.entries(clause)) {
          if (key === '$or') {
            return val.some(clause => evaluate(clause));
          }
          if (conditionalFields[key] === false) {
            result = false;
            break;
          }
          if (Array.isArray(self.getFieldValue(key))) {
            result = self.getFieldValue(key).includes(val);
            break;
          }
          if (val !== self.getFieldValue(key)) {
            result = false;
            break;
          }
        }
        return result;
      }

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
      console.error(e);
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
        await apos.notify((e.body && e.body.message) || fallback, {
          type: 'danger',
          icon: 'alert-circle-icon',
          dismiss: true
        });
      }
    },
    triggerValidate() {
      this.triggerValidation = true;
      this.$nextTick(async () => {
        this.triggerValidation = false;
      });
    },
    // Perform any postprocessing required by direct or nested schema fields
    // before the object can be saved
    async postprocess() {
      // Relationship fields may have postprocessors (e.g. autocropping)
      const relationships = findRelationships(this.schema, this.docFields.data);
      for (const relationship of relationships) {
        if (!(relationship.value && relationship.field.postprocessor)) {
          continue;
        }
        const withType = relationship.field.withType;
        const module = apos.modules[withType];
        relationship.context[relationship.field.name] = (await apos.http.post(`${module.action}/${relationship.field.postprocessor}`, {
          qs: {
            aposMode: 'draft'
          },
          body: {
            relationship: relationship.value,
            // Pass the options of the widget currently being edited, some
            // postprocessors need these (e.g. autocropping cares about widget aspectRatio)
            widgetOptions: apos.area.widgetOptions[0]
          },
          busy: true
        })).relationship;
      }
      function findRelationships(schema, object) {
        let relationships = [];
        for (const field of schema) {
          if (field.type === 'relationship') {
            relationships.push({
              context: object,
              field,
              value: object[field.name]
            });
          } else if (field.type === 'array') {
            for (const value of (object[field.name] || [])) {
              relationships = [ ...relationships, findRelationships(field.schema, value) ];
            }
          } else if (field.type === 'object') {
            relationships = [ ...relationships, findRelationships(field.schema, object[field.name] || {}) ];
          }
        }
        return relationships;
      }
    }
  }
};
