import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';
import { klona } from 'klona';
import { createId, get } from 'apostrophe/lib/beneath.js';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';
import {
  getOutsideValue, hasOutsideId, isSameOutsideValue
} from 'Modules/@apostrophecms/ui/utils';
import newInstance from 'apostrophe/modules/@apostrophecms/schema/lib/newInstance.js';

export default {
  name: 'AposArrayEditor',
  mixins: [
    AposModifiedMixin,
    AposEditorMixin
  ],
  props: {
    items: {
      required: true,
      type: Array
    },
    meta: {
      type: Object,
      default: () => ({})
    },
    field: {
      required: true,
      type: Object
    },
    inputSchema: {
      type: Array,
      required: true
    },
    serverError: {
      type: Object,
      default: null
    },
    docId: {
      type: String,
      default: null
    },
    // The `_id` of the item to open on, else the first
    activeItem: {
      type: String,
      default: null
    }
  },
  emits: [ 'modal-result' ],
  data() {
    // Automatically add `_id` to default items
    const items = this.items.map(item => ({
      ...item,
      _id: item._id || createId()
    }));

    return {
      currentId: null,
      currentDoc: { data: {} },
      modal: {
        active: false,
        type: 'overlay',
        showModal: false,
        triggerFocusRefresh: 0
      },
      modalTitle: {
        key: 'apostrophe:editType',
        type: this.$t(this.field.label)
      },
      titleFieldChoices: null,
      // If we don't clone, then we're making
      // permanent modifications whether the user
      // clicks save or not
      next: klona(items),
      original: klona(items),
      triggerValidation: false,
      minError: false,
      maxError: false,
      cancelDescription: 'apostrophe:arrayCancelDescription'
    };
  },
  computed: {
    // The document is given by a document editor only: in a widget editor it
    // is the editor's below this one
    screen() {
      return {
        kind: 'arrayEditor',
        docId: this.docId || null,
        field: this.field.name,
        itemId: this.currentId || null
      };
    },
    moduleOptions() {
      return window.apos.schema || {};
    },
    // What came from outside for the items, by `_id`: `{ busy, edited }`,
    // shown on their rows. The array itself busy makes every item busy
    outsideItems() {
      const items = {};
      for (const [ path, state ] of Object.entries(this.outsideFields)) {
        const ids = (path === this.field.name)
          ? this.next.map(({ _id }) => _id)
          : [ this.getOutsideItem(path) ].filter(Boolean);
        for (const _id of ids) {
          items[_id] = {
            busy: Boolean(items[_id]?.busy || state.busy),
            edited: Boolean(items[_id]?.edited || state.edited)
          };
        }
      }
      return items;
    },
    itemError() {
      return this.currentDoc && this.currentDoc.hasErrors;
    },
    valid() {
      return !(this.minError || this.maxError || this.itemError);
    },
    maxed() {
      return (this.field.max !== undefined) && (this.next.length >= this.field.max);
    },
    schema() {
      // For AposDocEditorMixin
      return (this.inputSchema || this.field.schema || [])
        .filter(field => apos.schema.components.fields[field.type]);
    },
    countLabel() {
      return this.$t('apostrophe:numberAdded', {
        count: this.next.length
      });
    },
    // Here in the array editor we use effectiveMin to factor in the
    // required property because there is no other good place to do that,
    // unlike the input field wrapper which has a separate visual
    // representation of "required".
    minLabel() {
      if (this.effectiveMin) {
        return this.$t('apostrophe:minUi', {
          number: this.effectiveMin
        });
      } else {
        return false;
      }
    },
    maxLabel() {
      if ((typeof this.field.max) === 'number') {
        return this.$t('apostrophe:maxUi', {
          number: this.field.max
        });
      } else {
        return false;
      }
    },
    effectiveMin() {
      if (this.field.min) {
        return this.field.min;
      } else if (this.field.required) {
        return 1;
      } else {
        return 0;
      }
    },
    currentDocServerErrors() {
      let serverErrors = null;
      ((this.serverError && this.serverError.data && this.serverError.data.errors) || [])
        .forEach(error => {
          const [ _id, fieldName ] = error.path.split('.');
          if (_id === this.currentId) {
            serverErrors = serverErrors || {};
            serverErrors[fieldName] = error;
          }
        });
      return serverErrors;
    },
    currentDocMeta() {
      return this.meta[this.currentId]?.aposMeta || {};
    },
    isModified() {
      if (this.currentId) {
        const currentIndex = this.next.findIndex(item => item._id === this.currentId);
        if (detectDocChange(this.schema, this.next[currentIndex], this.currentDoc.data)) {
          return true;
        }
      }
      if (this.next.length !== this.original.length) {
        return true;
      }
      for (let i = 0; (i < this.next.length); i++) {
        if (this.next[i]._id !== this.original[i]._id) {
          return true;
        }
        if (detectDocChange(this.schema, this.next[i], this.original[i])) {
          return true;
        }
      }
      return false;
    }
  },
  async mounted() {
    this.modal.active = true;
    await this.evaluateExternalConditions();
    if (this.next.length) {
      const active = this.next.find(({ _id }) => _id === this.activeItem);
      this.setCurrentDoc((active || this.next.at(0))._id);
    }
    if (this.serverError?.data?.errors?.length) {
      const first = this.serverError.data.errors[0];
      const [ _id, name ] = first.path?.split('.') || [];
      if (_id) {
        await this.select(_id);
        const aposSchema = this.$refs.schema;
        await this.$nextTick();
        name && aposSchema.scrollFieldIntoView(name);
      }
    }
    this.titleFieldChoices = await this.getTitleFieldChoices();
    this.modal.triggerFocusRefresh++;
  },
  methods: {
    // The item opened on is scrolled into view in the rail
    async show() {
      this.modal.showModal = true;
      if (!this.activeItem) {
        return;
      }
      await this.$nextTick();
      this.$el.querySelector(`.apos-modal-array-items [data-id="${this.activeItem}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    },
    setCurrentDoc(_id) {
      this.currentId = _id;
      this.currentDoc = {
        hasErrors: false,
        data: this.next.find(item => item._id === _id)
      };
      this.evaluateConditions();
      this.triggerValidation = false;
    },
    async select(_id) {
      if (this.currentId === _id) {
        return;
      }
      if (await this.validate(true, false)) {
        this.currentDocToCurrentItem();
        this.setCurrentDoc(_id);
      }
    },
    update(items) {
      // Take care to use the same items in order to avoid
      // losing too much state inside draggable, otherwise
      // drags fail
      this.next = items.map(item => this.next.find(_item => item._id === _item._id));
      if (this.currentId) {
        if (!this.next.some(item => item._id === this.currentId)) {
          this.currentId = this.next.at(0)?._id || null;
          this.currentDoc = { data: this.next.at(0) || {} };
        }
      }
      this.updateMinMax();
    },
    currentDocUpdate(currentDoc) {
      this.currentDoc = currentDoc;
      this.dropTouchedOutside();
      this.evaluateConditions();
    },
    async add() {
      if (await this.validate(true, false)) {
        const item = this.newInstance();
        item._id = createId();
        this.next.push(item);
        await this.select(item._id);
        this.updateMinMax();
        this.modal.triggerFocusRefresh++;
      }
    },
    updateMinMax() {
      let minError = false;
      let maxError = false;
      if (this.effectiveMin) {
        if (this.next.length < this.effectiveMin) {
          minError = true;
        }
      }
      if (this.field.max !== undefined) {
        if (this.next.length > this.field.max) {
          maxError = true;
        }
      }
      this.minError = minError;
      this.maxError = maxError;
    },
    async submit() {
      if (await this.validate(true, true)) {
        this.currentDocToCurrentItem();
        for (const item of this.next) {
          item.metaType = 'arrayItem';
        }
        this.handOverOutside();
        this.$emit('modal-result', this.next);
        this.modal.showModal = false;
      }
    },
    currentDocToCurrentItem() {
      if (!this.currentId) {
        return;
      }
      const currentIndex = this.next.findIndex(item => item._id === this.currentId);
      this.next[currentIndex] = this.currentDoc.data;
    },
    getFieldValue(name) {
      return this.currentDoc.data[name];
    },
    // Values from outside reach the whole array: the array by its field's
    // name, its items by `@<id>`. The current item takes them in its fields,
    // the others in the list. A changed item's row shows busy and "Edited
    // by AI", the current item's fields too
    getOutsideRoot() {
      return {
        kind: 'array',
        data: this.getOutsideData(),
        fieldId: this.field._id,
        locale: this.getOutsideLocale()
      };
    },
    // The items, the current one as edited
    getOutsideData() {
      return {
        [this.field.name]: this.next.map(item => {
          return (item._id === this.currentId)
            ? {
              ...this.currentDoc.data,
              _id: this.currentId
            }
            : item;
        })
      };
    },
    // The `_id` of the item holding a key, `null` for the array itself
    getOutsideItem(key) {
      if (!key.startsWith('@')) {
        return null;
      }
      const _id = key.slice(1).split('.')[0];
      return this.getOutsideData()[this.field.name]
        .find(item => hasOutsideId(item, _id))?._id || null;
    },
    // A field of the current item holding a key; the other items show
    // their state on their rows only
    getOutsideTop(key) {
      if (!this.currentId || (this.getOutsideItem(key) !== this.currentId)) {
        return null;
      }
      return AposEditorMixin.methods.getOutsideTop.call(this, key);
    },
    getOutsideRelative(key) {
      const prefix = `@${this.currentId}.`;
      return key.startsWith(prefix) ? key.slice(prefix.length) : key;
    },
    getOutsideTarget(key) {
      return ((key === this.field.name) || this.getOutsideItem(key)) ? this.field : null;
    },
    // Writes the array, `values` by the array field's name: each item it
    // keeps stays as it is, a changed one takes its new value, the current
    // one in its fields. Each key of `touched` is marked edited, the array
    // itself as each item it changed or added
    async applyOutside(values, {
      marker = null, touched = null, removed = []
    } = {}) {
      const { name } = this.field;
      const refused = Object.keys(values)
        .filter(key => key !== name)
        .map(key => ({
          name: key,
          reason: 'unknown'
        }));
      if (!Array.isArray(values[name])) {
        return {
          written: [],
          refused
        };
      }
      const held = new Map(this.getOutsideData()[name].map(item => [ item._id, item ]));
      const items = klona(values[name]);
      const changed = items
        .filter(item => {
          return !held.has(item._id) || !isSameOutsideValue(held.get(item._id), item);
        })
        .map(item => item._id);
      this.next = items.map(item => {
        const kept = this.next.find(({ _id }) => _id === item._id);
        if (!changed.includes(item._id)) {
          return kept;
        }
        if (item._id === this.currentId) {
          this.$refs.schema.applyOutsideData(item);
          return kept;
        }
        return item;
      });
      if (!this.next.some(({ _id }) => _id === this.currentId)) {
        if (this.next.length) {
          this.setCurrentDoc(this.next[0]._id);
        } else {
          this.currentId = null;
          this.currentDoc = { data: {} };
        }
      }
      this.updateMinMax();
      for (const path of Object.keys(this.outsideFields)) {
        if (this.outsideFields[path].busy) {
          this.releaseOutsidePath(path);
        }
      }
      // The current item's fields take their values, then emit them
      await this.$nextTick();
      await this.$nextTick();
      const data = this.getOutsideData();
      const keys = (touched || [ name ]).flatMap(key => {
        return (key === name) ? changed.map(_id => `@${_id}`) : [ key ];
      });
      for (const key of keys) {
        this.outsideFields[key] = {
          busy: false,
          edited: true,
          marker,
          type: null,
          value: klona(getOutsideValue(data, key))
        };
      }
      this.listOutsideRemoved(removed, marker);
      this.announceOutside('apostrophe:outsideEdited', [ this.field ]);
      return {
        written: [ name ],
        refused
      };
    },

    async validate(validateItem, validateLength) {
      if (validateItem && this.next.length > 0 && this.currentId) {
        this.triggerValidation = true;
      }
      await this.$nextTick();
      if (validateLength) {
        this.updateMinMax();
      }
      if (
        (validateLength && (this.minError || this.maxError)) ||
        (validateItem && (this.currentDoc && this.currentDoc.hasErrors))
      ) {
        await apos.notify('apostrophe:resolveErrorsFirst', {
          type: 'warning',
          icon: 'alert-circle-icon',
          dismiss: true
        });
        return false;
      } else {
        return true;
      }
    },
    newInstance() {
      return newInstance(this.schema);
    },
    label(item) {
      let candidate;
      if (this.field.titleField) {

        // Initial field value
        candidate = get(item, this.field.titleField);

        // If the titleField references a select input, use the
        // select label as the slat label, rather than the value.
        if (this.titleFieldChoices) {
          const choice = this.titleFieldChoices
            .find(choice => choice.value === candidate);
          if (choice && choice.label) {
            candidate = choice.label;
          }
        }

      } else if (this.schema.find(field => field.name === 'title') && (item.title !== undefined)) {
        candidate = item.title;
      }
      if ((candidate == null) || candidate === '') {
        for (let i = 0; (i < this.next.length); i++) {
          if (this.next[i]._id === item._id) {
            candidate = `#${i + 1}`;
            break;
          }
        }
      }
      return candidate;
    },
    withLabels(items) {
      const result = items.map(item => ({
        ...item,
        title: this.label(item)
      }));
      return result;
    },
    async getTitleFieldChoices() {
      // If the titleField references a select input, get it's choices
      // to use as labels for the slat UI

      let choices = null;
      const titleField = this.schema.find(field => field.name === this.field.titleField);

      // The titleField is a select
      if (titleField?.choices) {

        // Choices are provided by a method
        if (typeof titleField.choices === 'string') {
          const action = `${this.moduleOptions.action}/choices`;
          try {
            const result = await apos.http.get(
              action,
              {
                qs: {
                  fieldId: titleField._id
                }
              }
            );
            if (result && result.choices) {
              choices = result.choices;
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error(this.$t('apostrophe:errorFetchingTitleFieldChoicesByMethod', { name: titleField.name }));
          }

        // Choices are a normal, hardcoded array
        } else if (Array.isArray(titleField.choices)) {
          choices = titleField.choices;
        }
      }
      return choices;
    }
  }
};
