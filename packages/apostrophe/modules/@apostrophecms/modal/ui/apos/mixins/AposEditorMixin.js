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
 * 5. Values from outside the editor, such as the assistant's, through the
 *   `outside` handle: `busy(names)`, `apply(values)` and `release(names)`,
 *   and `adopt(fields)` for what a nested editor's save hands over
 *
 * This mixin is designed to accommodate extension by components like
 *   AposDocEditor that split the UI into several AposSchemas.
 */

import { markRaw } from 'vue';
import { klona } from 'klona';
import { getOutsideSave } from 'Modules/@apostrophecms/ui/utils';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';
import {
  evaluateExternalConditions, getConditionalFields, getConditionTypesObject
} from 'Modules/@apostrophecms/schema/lib/conditionalFields.js';

export default {
  props: {
    parentFollowingValues: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      docFields: {
        data: {}
      },
      serverErrors: null,
      restoreOnly: false,
      readOnly: false,
      changed: [],
      externalConditionsResults: getConditionTypesObject(),
      conditionalFields: getConditionTypesObject(),
      // Fields written from outside, by `getOutsideKey`:
      // `{ busy, edited, marker }`. In memory only
      outsideFields: {},
      outsideAnnouncement: '',
      // Passed to `AposModal`, which keeps it on the modal's stack entry.
      // Each call takes field names of this editor's schema; `apply` takes a
      // `marker` the save carries for the fields it wrote
      outside: markRaw({
        busy: names => this.markOutsideBusy(names),
        apply: (values, options) => this.applyOutside(values, options),
        release: names => this.releaseOutside(names),
        adopt: fields => this.adoptOutside(fields)
      })
    };
  },

  computed: {
    schema() {
      let schema = (this.moduleOptions.schema || [])
        .filter(field => apos.schema.components.fields[field.type]);
      if (this.restoreOnly || this.readOnly) {
        schema = klona(schema);
        for (const field of schema) {
          field.readOnly = true;
        }
      }
      // Archive UI is handled via action buttons
      schema = schema.filter(field => field.name !== 'archived');
      return schema;
    },
    docMeta() {
      return this.docFields.data?.aposMeta || {};
    },
    // What came from outside for the fields shown, by field name
    outsideStates() {
      const states = {};
      for (const field of this.schema) {
        const state = this.getOutsideState(field.name);
        if (state) {
          states[field.name] = state;
        }
      }
      return states;
    }
  },

  watch: {
    docType: {
      // Evaluate external conditions found in current page-type's schema
      async handler() {
        if (this.moduleName === '@apostrophecms/page') {
          await this.evaluateExternalConditions();
          this.evaluateConditions();
        }
      }
    }
  },

  methods: {
    // Evaluate the external conditions found in each field
    // via API calls -made in parallel for performance-
    // and store their result for reusability.
    async evaluateExternalConditions() {
      this.externalConditionsResults = await evaluateExternalConditions(
        this.schema,
        this.docId || this.docFields?.data?._docId || this.docFields?.data?._id,
        this.$t
      );
    },

    // followedByCategory may be falsy (all fields), "other" or "utility". The
    // returned object contains properties named for each field in that category
    // that follows other fields. For instance if followedBy is "utility" then
    // in our default configuration `followingValues` will be:
    //
    // `{ slug: { title: 'latest title here' } }`
    followingValues(followedByCategory, parentOnly = false) {
      const fields = this.getFieldsByCategory(followedByCategory);

      const followingValues = {};
      const parentFollowing = {};
      for (const [ key, val ] of Object.entries(this.parentFollowingValues || {})) {
        parentFollowing[`<${key}`] = val;
      }

      if (parentOnly) {
        // If we are only interested in the parent following values, return them
        return parentFollowing;
      }

      for (const field of fields) {
        if (field.following) {
          const following = Array.isArray(field.following)
            ? field.following
            : [ field.following ];
          followingValues[field.name] = {};
          for (const name of following) {
            if (name.startsWith('<')) {
              followingValues[field.name][name] = parentFollowing[name];
            } else {
              followingValues[field.name][name] = this.getFieldValue(name);
            }
          }
        }
      }
      return followingValues;
    },

    // Fetch the subset of the schema in the given category, either
    // 'utility' or 'other', or the entire schema if followedByCategory
    // is falsy
    getFieldsByCategory(followedByCategory) {
      if (followedByCategory && this.utilityFields) {
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
    getConditionalFields(followedByCategory) {
      const values = {
        // Append the parent following values without the current doc
        // values, so that the parent can be used in conditions
        ...this.followingValues(followedByCategory, true),
        // currentDoc for arrays, docFields for all other editors
        ...(this.currentDoc ? this.currentDoc.data : this.docFields.data)
      };
      return getConditionalFields(
        this.getFieldsByCategory(followedByCategory),
        values,
        this.externalConditionsResults
      );
    },

    evaluateConditions() {
      this.conditionalFields = this.getConditionalFields();
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
      // eslint-disable-next-line no-console
      console.error(e);
      if (e.body?.data?.errors) {
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
        // As per the new standard, any message in `data.detail` is considered
        // a human readable error message. If it is not present, we fall back to
        // the message in `body.message` or the fallback.
        const bodyMessage = e.body?.data?.detail || e.body?.message;
        await apos.notify(bodyMessage || fallback, {
          type: 'danger',
          icon: 'alert-circle-icon',
          dismiss: true
        });
      }
    },
    // A field's key in `outsideFields`: its name, or its path in the
    // document where the editor holds part of one
    getOutsideKey(name) {
      return name;
    },
    getOutsideState(name) {
      return this.outsideFields[this.getOutsideKey(name)] || null;
    },
    // A field of the schema code outside may write: shown, and not read only
    getOutsideField(name) {
      const field = this.schema.find(field => field.name === name);
      return (field && !field.readOnly && !field.hidden) ? field : null;
    },
    // Whether the editor shows what values from outside would go into
    isOutsideReady() {
      return true;
    },
    // Marks fields busy while a write from outside is on its way. Returns the
    // names it marked
    markOutsideBusy(names) {
      const fields = this.isOutsideReady()
        ? names
          .map(name => this.getOutsideField(name))
          .filter(field => field && this.getAposSchema(field))
        : [];
      for (const field of fields) {
        const key = this.getOutsideKey(field.name);
        this.outsideFields[key] = {
          ...this.outsideFields[key],
          busy: true
        };
      }
      this.announceOutside('apostrophe:outsideBusy', fields);
      return fields.map(field => field.name);
    },
    // Frees busy fields no value came for
    releaseOutside(names) {
      for (const name of names) {
        const key = this.getOutsideKey(name);
        if (this.outsideFields[key]?.edited) {
          this.outsideFields[key] = {
            ...this.outsideFields[key],
            busy: false
          };
        } else {
          delete this.outsideFields[key];
        }
      }
    },
    // Writes `values`, by field name, into the fields as if typed: conditions,
    // validation and the modified state follow, and each field is marked
    // edited. Resolves once the values reached `docFields`, with the names
    // `written` and those `refused` with a `reason`: `unknown`, `readOnly`
    // or `notReady` while the editor loads
    async applyOutside(values, { marker = null } = {}) {
      const written = [];
      const refused = [];
      for (const [ name, value ] of Object.entries(values)) {
        const field = this.getOutsideField(name);
        const schema = field && this.isOutsideReady() && this.getAposSchema(field);
        if (!schema) {
          refused.push({
            name,
            reason: field
              ? 'notReady'
              : this.schema.some(field => field.name === name) ? 'readOnly' : 'unknown'
          });
          continue;
        }
        schema.applyOutsideValue(name, klona(value));
        this.outsideFields[this.getOutsideKey(name)] = {
          busy: false,
          edited: true,
          marker
        };
        written.push(field);
      }
      this.announceOutside('apostrophe:outsideEdited', written);
      // The input takes the value, then emits it to the editor
      await this.$nextTick();
      await this.$nextTick();
      return {
        written: written.map(field => field.name),
        refused
      };
    },
    // What this editor's save carries for the fields written from outside
    // (see `getOutsideSave`)
    getOutsideSave() {
      return getOutsideSave(this.outsideFields);
    },
    // A nested editor (widget, array item) saves into the editor below it,
    // which saves the document: that editor takes over the fields written
    // from outside. On the page, the context bar carries them with its next
    // save
    handOverOutside() {
      const edited = Object.fromEntries(
        Object.entries(this.outsideFields)
          .filter(([ , state ]) => state.edited && state.marker)
      );
      if (!Object.keys(edited).length) {
        return;
      }
      const { stack } = useModalStore();
      const index = stack.findIndex(modal => modal.outside === this.outside);
      const below = stack
        .slice(0, Math.max(index, 0))
        .reverse()
        .find(modal => modal.outside);
      if (below) {
        below.outside.adopt(edited);
      } else {
        apos.bus.$emit('outside-handed-over', { fields: edited });
      }
    },
    // Fields a nested editor wrote from outside, by their paths in the
    // document
    adoptOutside(fields) {
      for (const [ path, { marker } ] of Object.entries(fields)) {
        this.outsideFields[path] = {
          busy: false,
          edited: true,
          marker
        };
      }
    },
    // Save, a reload or a switch of locale ends what came from outside
    clearOutside() {
      this.outsideFields = {};
      this.outsideAnnouncement = '';
    },
    async announceOutside(key, fields) {
      if (!fields.length) {
        return;
      }
      // The same message twice is read again only after a change
      this.outsideAnnouncement = '';
      await this.$nextTick();
      this.outsideAnnouncement = this.$t(key, {
        fields: fields.map(field => this.$t(field.label || field.name)).join(', ')
      });
    },
    triggerValidate() {
      this.triggerValidation = true;
      this.$nextTick(() => {
        this.triggerValidation = false;
      });
    },
    async postprocess() {
      // eslint-disable-next-line no-console
      console.warn(
        'The function postprocess from AposEditorMixin does not do anything anymore.\nRelationship postprocessing is made at input level in AposInputRelationship and in some cases globally like in AposImageWidget.'
      );
    }
  }
};
