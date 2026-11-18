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
 *   `outside` handle: `read()` for what the editor holds, `busy(keys)`,
 *   `apply(values)` and `release(keys)`, `adopt(fields)` for what a
 *   nested editor's save hands over and `edited()` for the fields still as
 *   written. A key is a field's, at any depth, relative to what the editor
 *   holds (`title`, `seo.title`, `@<widget or item id>.title`,
 *   `@<widget id>`); its state shows on the innermost widget of an area
 *   holding it, else on the innermost field shown holding it. A field the
 *   editor changes afterwards is the editor's own again
 *
 * This mixin is designed to accommodate extension by components like
 *   AposDocEditor that split the UI into several AposSchemas.
 */

import { markRaw } from 'vue';
import { klona } from 'klona';
import { createId } from 'apostrophe/lib/beneath.js';
import {
  getOutsidePlace, getOutsideSave, getOutsideValue, hasOutsideId
} from 'Modules/@apostrophecms/ui/utils';
import { detectFieldChange } from 'Modules/@apostrophecms/schema/lib/detectChange';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget';
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
      // Fields written from outside, by their path in the document (see
      // `getOutsideKey`): `{ busy, edited, marker, type, value }`, `value`
      // what landed, in a field of that `type` when it is a top-level one.
      // In memory only
      outsideFields: {},
      outsideAnnouncement: '',
      // Passed to `AposModal`, which keeps it on the modal's stack entry.
      // `apply` takes values by field name of this editor's schema, the
      // `touched` keys to mark (the names by default) and a `marker` the
      // save carries for them
      outside: markRaw({
        id: createId(),
        read: () => this.getOutsideRoot(),
        busy: keys => this.markOutsideBusy(keys),
        apply: (values, options) => this.applyOutside(values, options),
        release: keys => this.releaseOutside(keys),
        adopt: fields => this.adoptOutside(fields),
        edited: () => this.getOutsideEdited()
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
    // What came from outside for the fields shown: `fields` by the nested
    // schema showing them (`''` for this editor's own, see `getOutsidePlace`),
    // then by field name, `{ busy, edited }` on the innermost field shown
    // that holds a key, unless a widget of an area shows it; `inert` on a
    // top-level field while any key it holds is busy. `items`: by `_id`, the
    // inline array items holding a key. `tops`: by name, each top-level field
    // busy or edited for any key it holds, wherever that key shows
    outsideStates() {
      const fields = { '': {} };
      const items = {};
      const tops = {};
      const value = Object.fromEntries(this.schema.map(field => {
        return [ field.name, this.getFieldValue(field.name) ];
      }));
      for (const [ path, state ] of Object.entries(this.outsideFields)) {
        const top = this.getOutsideTop(path);
        if (!top) {
          continue;
        }
        fields[''][top] = {
          ...fields[''][top],
          inert: Boolean(fields[''][top]?.inert || state.busy)
        };
        tops[top] = mergeOutsideState(tops[top], state);
        if (this.getOutsideWidget(path)) {
          continue;
        }
        const key = this.getOutsideRelative(path);
        const place = getOutsidePlace(this.schema, value, key) || {
          scope: '',
          name: top,
          items: []
        };
        fields[place.scope] = fields[place.scope] || {};
        fields[place.scope][place.name] = mergeOutsideState(
          fields[place.scope][place.name],
          state
        );
        for (const _id of place.items) {
          items[_id] = mergeOutsideState(items[_id], state);
        }
      }
      return {
        fields,
        items,
        tops
      };
    },
    // What came from outside for the widgets of this editor's areas, by
    // widget `_id`: `{ busy, edited }` (see `getOutsideWidget`), shown
    // through the widget store
    outsideWidgets() {
      const widgets = {};
      for (const [ path, state ] of Object.entries(this.outsideFields)) {
        const _id = this.getOutsideWidget(path);
        if (!_id || !this.getOutsideTop(path)) {
          continue;
        }
        widgets[_id] = mergeOutsideState(widgets[_id], state);
      }
      return widgets;
    }
  },

  watch: {
    // The widgets show their state from the widget store, which reaches the
    // areas a widget's rendering holds
    outsideWidgets(widgets) {
      useWidgetStore().setOutsideWidgets(this.outside.id, widgets);
    },
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

  beforeUnmount() {
    useWidgetStore().setOutsideWidgets(this.outside.id, null);
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
    // A key's path in the document, as `outsideFields` and the save name
    // it: the key itself, or below the widget or item the editor holds
    getOutsideKey(key) {
      const rootId = this.getOutsideRootId();
      return (rootId && !key.startsWith('@'))
        ? `@${rootId}.${key}`
        : key;
    },
    // The `_id` of the widget or item the editor holds, `null` for a
    // document
    getOutsideRootId() {
      return null;
    },
    // A key or a path relative to this editor's schema: below the widget or
    // item the editor holds, without its `@<id>.`
    getOutsideRelative(key) {
      const rootId = this.getOutsideRootId();
      return (rootId && key.startsWith(`@${rootId}.`))
        ? key.slice(rootId.length + 2)
        : key;
    },
    // The top-level field of this editor's schema holding a key or a path,
    // `null` when none of the fields shown holds it
    getOutsideTop(key) {
      const rest = this.getOutsideRelative(key);
      const name = rest.startsWith('@')
        ? this.schema.find(field => {
          return hasOutsideId(this.getFieldValue(field.name), rest.slice(1).split('.')[0]);
        })?.name
        : rest.split('.')[0];
      return (name && this.schema.some(field => field.name === name)) ? name : null;
    },
    // The `_id` of the innermost widget of an area in what the editor holds
    // that holds a key or a path: the widget it names, or the one holding
    // the item or object it names. `null` for a key no widget holds, and
    // for the widget the editor holds itself
    getOutsideWidget(key) {
      if (!key.startsWith('@')) {
        return null;
      }
      const _id = key.slice(1).split('.')[0];
      const data = this.getOutsideData();
      if (!data || (data._id === _id)) {
        return null;
      }
      return findOutsideWidget(data, _id, null) || null;
    },
    // What the editor holds, as code outside reads and changes it: `{ kind,
    // data, locale }`, `kind` one of `document`, `widget` and `item`, a
    // widget's `areaFieldId` and an item's `fieldId`. `null` while it loads
    getOutsideRoot() {
      return null;
    },
    // The editor's locale: that of the nearest modal at or below it that
    // has one, else the page's
    getOutsideLocale() {
      const { stack } = useModalStore();
      const index = stack.findIndex(modal => modal.outside === this.outside);
      return stack
        .slice(0, index + 1)
        .findLast(modal => modal.locale)?.locale || apos.i18n.locale;
    },
    // What the keys of `outsideFields` are read from: the document, or the
    // part of one the editor holds, with its `_id`
    getOutsideData() {
      return this.docFields.data;
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
    // A field of the schema code outside may write now, by key: its
    // top-level field, shown and ready
    getOutsideTarget(key) {
      const name = this.isOutsideReady() && this.getOutsideTop(key);
      const field = name && this.getOutsideField(name);
      return (field && this.getAposSchema(field)) ? field : null;
    },
    // Marks keys busy while a write from outside is on its way, announcing
    // the fields that were not busy yet. Returns the keys it marked
    markOutsideBusy(keys) {
      const marked = keys.filter(key => this.getOutsideTarget(key));
      const wasBusy = new Set(Object.entries(this.outsideFields)
        .filter(([ , state ]) => state.busy)
        .map(([ path ]) => this.getOutsideTarget(path)));
      for (const key of marked) {
        const path = this.getOutsideKey(key);
        this.outsideFields[path] = {
          ...this.outsideFields[path],
          busy: true
        };
      }
      this.announceOutside('apostrophe:outsideBusy', [
        ...new Set(marked.map(key => this.getOutsideTarget(key)))
      ].filter(field => !wasBusy.has(field)));
      return marked;
    },
    // Frees busy keys no value came for
    releaseOutside(keys) {
      for (const key of keys) {
        this.releaseOutsidePath(this.getOutsideKey(key));
      }
    },
    releaseOutsidePath(path) {
      if (this.outsideFields[path]?.edited) {
        this.outsideFields[path] = {
          ...this.outsideFields[path],
          busy: false
        };
      } else {
        delete this.outsideFields[path];
      }
    },
    // Writes `values`, by field name, into the fields as if typed: conditions,
    // validation and the modified state follow, and each key of `touched`
    // in them (each field written by default) is marked edited, the other
    // keys busy in them freed. The widgets the write `removed`, by `_id`,
    // stay listed for the save, with no mark. Resolves once the values
    // reached `docFields`, with the names `written` and those `refused` with
    // a `reason`: `unknown`, `readOnly` or `notReady` while the editor loads
    async applyOutside(values, {
      marker = null, touched = null, removed = []
    } = {}) {
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
        written.push(field);
      }
      const names = written.map(field => field.name);
      for (const path of Object.keys(this.outsideFields)) {
        if (this.outsideFields[path].busy && names.includes(this.getOutsideTop(path))) {
          this.releaseOutsidePath(path);
        }
      }
      // The input takes the value, then emits it to the editor
      await this.$nextTick();
      await this.$nextTick();
      const data = this.getOutsideData();
      const marked = (touched || names).filter(key => {
        return names.includes(this.getOutsideTop(this.getOutsideKey(key)));
      });
      for (const key of marked) {
        const path = this.getOutsideKey(key);
        const field = written.find(field => field.name === key);
        this.outsideFields[path] = {
          busy: false,
          edited: true,
          marker,
          type: field?.type || null,
          value: klona(getOutsideValue(data, path))
        };
      }
      if (written.length) {
        this.listOutsideRemoved(removed, marker);
      }
      this.announceOutside('apostrophe:outsideEdited', written);
      return {
        written: written.map(field => field.name),
        refused
      };
    },
    // Widgets removed from outside: no longer shown, they stay in
    // `outsideFields` so the save lists their removal
    listOutsideRemoved(removed, marker) {
      for (const _id of removed) {
        this.outsideFields[`@${_id}`] = {
          busy: false,
          edited: true,
          marker,
          type: null,
          value: undefined
        };
      }
    },
    // Whether the editor changed a field since a value from outside landed
    // in it
    isOutsideTouched(key, state) {
      return Object.hasOwn(state, 'value') && detectFieldChange(
        { type: state.type },
        state.value,
        getOutsideValue(this.getOutsideData(), key)
      );
    },
    // Touched by the editor, owned by the editor: a field the editor
    // changed after a value from outside loses its mark, and the save no
    // longer lists it. Called on each update of the fields
    dropTouchedOutside() {
      for (const [ path, state ] of Object.entries(this.outsideFields)) {
        if (!state.busy && this.isOutsideTouched(path, state)) {
          delete this.outsideFields[path];
        }
      }
    },
    // The fields still as written from outside, those a nested editor
    // handed over included
    getOutsideEdited() {
      return Object.fromEntries(
        Object.entries(this.outsideFields).filter(([ key, state ]) => {
          return state.edited && !this.isOutsideTouched(key, state);
        })
      );
    },
    // What this editor's save carries for the fields written from outside
    // (see `getOutsideSave`)
    getOutsideSave() {
      return getOutsideSave(this.getOutsideEdited());
    },
    // A nested editor (widget, array item) saves into the editor below it,
    // which saves the document: that editor takes over the fields written
    // from outside. On the page, the context bar carries them with its next
    // save
    handOverOutside() {
      const edited = Object.fromEntries(
        Object.entries(this.getOutsideEdited())
          .filter(([ , state ]) => state.marker)
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
    // document, each with the value it saves
    adoptOutside(fields) {
      for (const [ path, state ] of Object.entries(fields)) {
        this.outsideFields[path] = { ...state };
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

// The `_id` of the innermost widget holding the widget, item or object of
// this `_id` in `value`, or being it; `undefined` when `value` doesn't hold
// it, `null` when no widget does. `widget` is the innermost one around
// `value`
function findOutsideWidget(value, _id, widget) {
  if (!value || (typeof value !== 'object')) {
    return undefined;
  }
  const children = (value.metaType === 'area') && Array.isArray(value.items)
    ? value.items.map(item => [ item, item?._id || null ])
    : Object.entries(value)
      .filter(([ name ]) => !name.startsWith('_'))
      .map(([ , child ]) => [ child, widget ]);
  for (const [ child, around ] of children) {
    if (child?._id === _id) {
      return around;
    }
    const found = findOutsideWidget(child, _id, around);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

// One state for several keys: busy or edited when any of them is
function mergeOutsideState(merged, state) {
  return {
    ...merged,
    busy: Boolean(merged?.busy || state.busy),
    edited: Boolean(merged?.edited || state.edited)
  };
}
