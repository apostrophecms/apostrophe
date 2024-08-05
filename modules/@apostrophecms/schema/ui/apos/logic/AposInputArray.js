import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import AposInputFollowingMixin from 'Modules/@apostrophecms/schema/mixins/AposInputFollowingMixin';
import AposInputConditionalFieldsMixin from 'Modules/@apostrophecms/schema/mixins/AposInputConditionalFieldsMixin';
import { getConditionTypesObject } from 'Modules/@apostrophecms/schema/lib/conditionalFields';

import { createId } from '@paralleldrive/cuid2';
import { klona } from 'klona';
import { get } from 'lodash';
import { Sortable } from 'sortablejs-vue3';

export default {
  name: 'AposInputArray',
  components: { draggable: Sortable },
  mixins: [
    AposInputMixin,
    AposInputFollowingMixin,
    AposInputConditionalFieldsMixin
  ],
  emits: [ 'validate' ],
  props: {
    generation: {
      type: Number,
      required: false,
      default: null
    }
  },
  data() {
    const next = this.getNext();
    // this.schema is a computed property and is not available in data, that's why we use this.field.schema here instead
    const items = modelItems(next, this.field, this.field.schema);
    return {
      next,
      items,
      isDragging: false,
      itemsConditionalFields: Object
        .fromEntries(items.map(({ _id }) => [ _id, getConditionTypesObject() ])),
      emptyWhenIcon: this.field?.whenEmpty?.icon || 'text-box-multiple-icon',
      emptyWhenLabel: this.field?.whenEmpty?.label || 'apostrophe:noItemsAdded'
    };
  },
  computed: {
    isInlineTable() {
      return this.field.style === 'table' && this.field.inline;
    },
    isInlineStandard() {
      return this.field.style !== 'table' && this.field.inline;
    },
    isDraggable() {
      if (this.field.draggable === false) {
        return false;
      }
      if (this.field.readOnly) {
        return false;
      }
      if (this.next.length > 1) {
        return true;
      }
      return true;
    },
    isAddDisabled() {
      return this.field.readOnly || (this.field.max && (this.items.length >= this.field.max));
    },
    inlineContextMenu() {
      const menu = [
        {
          label: this.$t('apostrophe:remove'),
          action: 'remove',
          modifiers: [ 'danger' ]
        }
      ];
      if (this.field.duplicate !== false) {
        menu.unshift({
          label: this.$t('apostrophe:duplicate'),
          action: 'duplicate'
        });
      }
      if (this.isDraggable) {
        menu.unshift(
          {
            label: this.$t('apostrophe:moveUp'),
            action: 'move-up'
          },
          {
            label: this.$t('apostrophe:moveDown'),
            action: 'move-down'
          }
        );
      }
      return menu;
    },
    // required by the conditional fields mixin
    schema() {
      return this.field.schema;
    },
    listId() {
      return `sortableList-${createId()}`;
    },
    dragOptions() {
      return {
        disabled: !this.isDraggable,
        ghostClass: 'apos-is-ghost',
        handle: this.isInlineTable ? '.apos-drag-handle' : '.apos-input-array-inline-header',
        dragClass: 'apos-is-dragging',
        forceFallback: true,
        fallbackTolerance: 5
      };
    },
    itemLabel() {
      return this.field.itemLabel
        ? {
          key: 'apostrophe:addType',
          type: this.$t(this.field.itemLabel)
        }
        : 'apostrophe:addItem';
    },
    editLabel() {
      return {
        key: 'apostrophe:editType',
        type: this.$t(this.field.label)
      };
    },
    effectiveError() {
      const error = this.error || this.serverError;
      // Server-side errors behave differently
      const name = error?.name || error;
      if (name === 'invalid' && !this.serverError) {
        // Not always due to a subproperty which will display its own error,
        // don't confuse the user if so
        return false;
      }
      return error;
    },
    arrayMeta() {
      return this.convertMetaToItems(this.items);
    }
  },
  watch: {
    generation() {
      this.next = this.getNext();
      this.items = modelItems(this.next, this.field, this.schema);
    },
    items: {
      deep: true,
      handler() {
        const erroneous = this.items.filter(item => item.schemaInput.hasErrors);
        if (erroneous.length) {
          erroneous.forEach(item => {
            if (!item.open) {
              // Make errors visible
              item.open = true;
            }
          });
        } else {
          const next = this.items.map(item => ({
            ...item.schemaInput.data,
            _id: item._id,
            metaType: 'arrayItem',
            scopedArrayName: this.field.scopedArrayName
          }));
          this.next = next;
        }
        // Our validate method was called first before that of
        // the subfields, so remedy that by calling again on any
        // change to the subfield state during validation
        if (this.triggerValidation) {
          this.validateAndEmit();
        }
      }
    }
  },
  async mounted() {
    if (this.field.inline) {
      await this.evaluateExternalConditions();
      this.setItemsConditionalFields();
    }
  },
  methods: {
    toggleAll(open) {
      this.items = this.items.map(item => ({
        ...item,
        open
      }));
    },
    startDragging(event) {
      const dragId = event.item.getAttribute('data-id');
      this.isDragging = true;
      this.disengageAll();
      this.toggleEngage(null, dragId);
    },
    stopDragging(event) {
      this.isDragging = false;
      document.getSelection().removeAllRanges();
      this.focusElement(event.item.getAttribute('data-id'));
    },
    getInlineMenuItems(index) {
      const menu = klona(this.inlineContextMenu);
      if (index === 0 && menu.find(i => i.action === 'move-up')) {
        menu.find(i => i.action === 'move-up').modifiers = [ 'disabled' ];
      }
      if (index + 1 === this.items.length && menu.find(i => i.action === 'move-down')) {
        menu.find(i => i.action === 'move-down').modifiers = [ 'disabled' ];
      }
      return menu;
    },
    getTableHeaderClass(field, baseClass) {
      let label = this.$t(field.label);
      const validChars = /[^a-zA-Z0-9_-]/g;
      label = label.replace(validChars, '-');
      label = label.toLowerCase();
      return `${baseClass}--${label}`;
    },
    toggleEngage(event, id) {
      const elId =
        event.target.getAttribute('data-id')
          ? event.target.getAttribute('data-id')
          : event.target.closest('[data-id]').getAttribute('data-id');
      if (elId) {
        if (this.items.find(i => i._id === elId)) {
          event.preventDefault();
          const was = this.items.find(i => i._id === elId).engaged;
          this.disengageAll();
          this.items.find(i => i._id === elId).engaged = !was;
        } else {
          this.disengageAll();
        }
      }
    },
    disengageAll() {
      this.items = this.items.map(i => {
        return {
          ...i,
          engaged: false
        };
      });
    },
    disengage(id) {
      const wasEngaged = this.items.find(i => i._id === id).engaged;
      if (wasEngaged) {
        this.items.find(i => i._id === id).engaged = false;
      }
    },
    moveUpdate({
      oldIndex, newIndex
    }) {
      if (oldIndex !== newIndex) {
        this.items = this.items.map((elem, index) => {
          return index === oldIndex
            ? this.items[newIndex]
            : (index === newIndex && this.items[oldIndex]) || elem;
        });
      }
    },
    getItemsSchema(_id) {
      return (this.items.find((item) => item._id === _id))?.schemaInput.data;
    },
    setItemsConditionalFields(itemId) {
      if (itemId) {
        this.itemsConditionalFields[itemId] = this.getConditionalFields(this.getItemsSchema(itemId));
        return;
      }

      for (const _id of Object.keys(this.itemsConditionalFields)) {
        this.itemsConditionalFields[_id] = this.getConditionalFields(this.getItemsSchema(_id));
      }
    },
    emitValidate() {
      this.$emit('validate');
    },
    validate(value) {
      if (this.items.find(item => item.schemaInput.hasErrors)) {
        return 'invalid';
      }
      if (this.field.required && !value.length) {
        return 'required';
      }
      if (this.field.min && value.length < this.field.min) {
        return 'min';
      }
      if (this.field.max && value.length > this.field.max) {
        return 'max';
      }
      if (value.length && this.field.fields && this.field.fields.add) {
        const [ uniqueFieldName, uniqueFieldSchema ] = Object.entries(this.field.fields.add).find(([ , subfield ]) => subfield.unique) || [];
        if (uniqueFieldName) {
          const duplicates = this.next
            .map(item =>
              Array.isArray(item[uniqueFieldName])
                ? item[uniqueFieldName].map(i => i._id).sort().join('|')
                : item[uniqueFieldName])
            .filter((item, index, array) => array.indexOf(item) !== index);

          if (duplicates.length) {
            duplicates.forEach(duplicate => {
              this.items.forEach(item => {
                uniqueFieldSchema.type === 'relationship'
                  ? item.schemaInput.data[uniqueFieldName] && item.schemaInput.data[uniqueFieldName].forEach(datum => {
                    item.schemaInput.fieldState[uniqueFieldName].duplicate = duplicate.split('|').find(i => i === datum._id);
                  })
                  : item.schemaInput.fieldState[uniqueFieldName].duplicate = item.schemaInput.data[uniqueFieldName] === duplicate;
              });
            });

            return {
              name: 'duplicate',
              message: `${this.$t('apostrophe:duplicateError')} ${this.$t(uniqueFieldSchema.label) || uniqueFieldName}`
            };
          }
        }
      }
      return false;
    },
    async edit() {
      const result = await apos.modal.execute('AposArrayEditor', {
        field: this.field,
        inputSchema: this.schema,
        items: this.next,
        serverError: this.serverError,
        docId: this.docId,
        parentFollowingValues: this.followingValues,
        meta: this.arrayMeta
      });
      if (result) {
        this.next = result;
      }
    },
    getNext() {
      // Next should consistently be an array.
      return (this.modelValue && Array.isArray(this.modelValue.data))
        ? this.modelValue.data
        : (this.field.def || []);
    },
    disableAdd() {
      return this.field.max && (this.items.length >= this.field.max);
    },
    remove(_id) {
      this.items = this.items.filter(item => item._id !== _id);
      delete this.itemsConditionalFields[_id];
    },
    add() {
      const _id = createId();
      this.items.push({
        _id,
        schemaInput: {
          data: this.newInstance()
        },
        open: true,
        engaged: false
      });
      this.setItemsConditionalFields(_id);
      this.focusElement(_id);
    },
    duplicate(originalId, originalIndex) {
      const original = this.items.find(i => i._id === originalId);
      const titleField = this.field.titleField || null;
      const id = createId();
      const dup = {
        _id: id,
        schemaInput: klona(original.schemaInput),
        open: false,
        engaged: false
      };
      const titleFieldVal = get(dup.schemaInput.data, titleField);
      if (titleField) {
        dup.schemaInput.data[titleField] = `${this.$t('apostrophe:duplicateOf')} ${titleFieldVal}`;
      }

      if (originalIndex + 1 === this.items.length) {
        this.items.push(dup);
      } else {
        this.items.splice(originalIndex + 1, 0, dup);
      }
      this.focusElement(id);
    },
    newInstance() {
      const instance = {};
      for (const field of this.schema) {
        if (field.def !== undefined) {
          instance[field.name] = klona(field.def);
        }
      }
      return instance;
    },
    getLabel(id, index) {
      const titleField = this.field.titleField || null;
      const item = this.items.find(item => item._id === id);
      return get(item.schemaInput.data, titleField) || `Item ${index + 1}`;
    },
    toggleOpenInlineItem(event) {
      if (event) {
        const el =
          event.target.getAttribute('data-id')
            ? event.target
            : event.target.closest('[data-id]');
        const elId = el.getAttribute('data-id');
        if (this.items.find(i => i._id === elId)) {
          event.preventDefault();
          const was = this.items.find(i => i._id === elId).open;
          this.items.find(i => i._id === elId).open = !was;
        }
      }
    },
    moveEngaged($e, id, direction) {
      const item = this.items.find(i => i._id === id);
      const index = this.items.indexOf(item);

      if (
        ((index + direction) === this.items.length) ||
        ((index + direction < 0))
      ) {
        // already first or last, don't move
        return;
      }

      if (this.items.find(i => i._id === id).engaged) {
        $e.stopImmediatePropagation();
        $e.preventDefault();
        this.moveUpdate({
          oldIndex: index,
          newIndex: index + direction
        });
        this.focusElement(id);
      }
    },
    focusElement(id) {
      this.$nextTick(() => {
        if (this.$refs.root.$el.querySelector(`[data-id="${id}"]`)) {
          this.$refs.root.$el.querySelector(`[data-id="${id}"]`).focus();
        }
      });
    },
    scrollToElement(el, id) {
      this.observe(el);
      this.$nextTick(() => {
        if (this.$refs.root.$el.querySelector(`[data-id="${id}"]`)) {
          // const el = this.$refs.root.$el.querySelector(`[data-id="${id}"]`);
          this.$refs.root.$el.querySelector(`[data-id="${id}"] .apos-input-array-inline-header`).scrollIntoView({
            behavior: 'smooth'
          });
          this.observe(el);
        }
      });
    },
    getFollowingValues(item) {
      return this.computeFollowingValues(item.schemaInput.data);
    },
    // Retrieve table heading fields from the schema, based on the currently
    // opened item. Available only when the field style is `table`.
    visibleSchema() {
      if (this.field.style !== 'table') {
        return this.schema;
      }
      const currentItem = this.items.find(item => item.open) ||
        this.items[this.items.length - 1];

      return this.schema.filter(
        field => this.itemsConditionalFields[currentItem._id]?.if[field.name] !== false
      );
    },
    inlineMenuHandler(event, { index, id }) {
      switch (event) {
        case 'move-up':
          this.moveUpdate({
            oldIndex: index,
            newIndex: index - 1
          });
          break;
        case 'move-down':
          this.moveUpdate({
            oldIndex: index,
            newIndex: index + 1
          });
          break;
        case 'remove':
          this.remove(id);
          break;
        case 'duplicate':
          this.duplicate(id, index);
          break;
      }
    }
  }
};

function modelItems(items, field, schema) {
  return items.map(item => {
    return {
      _id: item._id || createId(),
      schemaInput: {
        data: item || {}
      },
      open: false,
      engaged: false
    };
  });
}
