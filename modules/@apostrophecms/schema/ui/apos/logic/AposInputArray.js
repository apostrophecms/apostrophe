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
  emits: ['validate'],
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
        .fromEntries(items.map(({ _id }) => [_id, getConditionTypesObject()]))
    };
  },
  computed: {
    isInlineTable() {
      return this.field.style === 'table' && this.field.inline;
    },
    isInlineStandard() {
      return this.field.style !== 'table' && this.field.inline;
    },
    // required by the conditional fields mixin
    schema() {
      return this.field.schema;
    },
    alwaysExpand() {
      return alwaysExpand(this.field, this.schema);
    },
    listId() {
      return `sortableList-${createId()}`;
    },
    dragOptions() {
      return {
        // disabled: !this.field.draggable || this.field.readOnly || this.next.length <= 1,
        disabled: this.field.readOnly || this.next.length <= 1 || false,
        ghostClass: 'apos-is-ghost',
        handle: this.isInlineTable ? '.apos-drag-handle' : '.apos-input-array-inline-header',
        dragClass: 'apos-is-dragging',
        forceFallback: true,
        dragoverBubble: true
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
    // if (this.field.inline && this.field.style !== 'table') {
    //   console.log(this.$refs);
    //   console.log(this.schemaRefs);
    //   this.schemaRefs.forEach(c => {
    //     console.log(c.$el.getBoundingClientRect());
    //   });
    // }
  },
  methods: {
    toggleAll(open) {
      this.items = this.items.map(item => ({
        ...item,
        open
      }));
    },
    startDragging() {
      this.isDragging = true;
      // this.toggleAll(false);
    },
    stopDragging(hello) {
      this.isDragging = false;
      document.getSelection().removeAllRanges();
    },
    getInlineMenuItems(index) {
      const menu = [
        {
          label: 'Duplicate',
          action: 'duplicate'
        },
        {
          label: 'Move Up',
          action: 'move-up'
        },
        {
          label: 'Move Down',
          action: 'move-down'
        },
        {
          label: 'Delete',
          action: 'delete',
          modifiers: [ 'danger' ]
        }
      ];
      if (index === 0) {
        menu.find(i => i.action === 'move-up').modifiers = [ 'disabled' ];
      }
      if (index + 1 === this.items.length) {
        menu.find(i => i.action === 'move-down').modifiers = [ 'disabled' ];
      }
      return menu;
    },
    moveUpdate({
      oldIndex, newIndex
    }) {
      console.log('hi move update');
      console.log(oldIndex);
      console.log(newIndex);
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
        const [uniqueFieldName, uniqueFieldSchema] = Object.entries(this.field.fields.add).find(([, subfield]) => subfield.unique) || [];
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
        open: true
      });
      this.setItemsConditionalFields(_id);
      // this.openInlineItem(_id);
    },
    duplicate(originalId, originalIndex) {
      const original = this.items.find(i => i._id === originalId);
      const titleField = this.field.titleField || null;
      const dup = {
        _id: createId(),
        schemaInput: klona(original.schemaInput),
        open: false
      };
      const titleFieldVal = get(dup.schemaInput.data, titleField);
      if (titleField) {
        dup.schemaInput.data[titleField] = `Duplicate of ${titleFieldVal}`;
      }

      if (originalIndex + 1 === this.items.length) {
        this.items.push(dup);
      } else {
        this.items.splice(originalIndex + 1, 0, dup);
      }
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
    openInlineItem(id) {
      this.items.forEach(item => {
        item.open = (item._id === id) || this.alwaysExpand;
      });
    },
    closeInlineItem(id) {
      this.items.forEach(item => {
        item.open = this.alwaysExpand;
      });
    },
    toggleOpenInlineItem(item) {
      item.open = !item.open;
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
      console.log(event);
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
        case 'delete':
          this.remove(id);
          break;
        case 'duplicate':
          this.duplicate(id, index);
          break;
        default:
          console.log(`Sorry, we are out of ${expr}.`);
      }

    }
  }
};

function modelItems(items, field, schema) {
  return items.map(item => {
    // const open = alwaysExpand(field, schema);
    return {
      _id: item._id || createId(),
      schemaInput: {
        data: item || {}
      },
      open: false
    };
  });
}

function alwaysExpand(field, schema) {
  if (!field.inline) {
    return false;
  }
  if (field.inline.alwaysExpand === undefined) {
    return schema.length < 3;
  }
  return field.inline.alwaysExpand;
}
