
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import { createId } from '@paralleldrive/cuid2';

export default {
  name: 'AposInputArea',
  mixins: [ AposInputMixin ],
  props: {
    generation: {
      type: Number,
      required: false,
      default() {
        return null;
      }
    }
  },
  data () {
    return {
      next: this.modelValue.data || this.getEmptyValue(),
      error: false,
      // This is just meant to be sufficient to prevent unintended collisions
      // in the UI between id attributes
      uid: Math.random()
    };
  },
  computed: {
    editorComponent() {
      return window.apos.area.components.editor;
    },
    choices() {
      const result = [];

      let widgets = this.field.options.widgets || {};
      if (this.field.options.groups) {
        for (const group of Object.entries(this.field.options.groups)) {
          widgets = {
            ...widgets,
            ...group.widgets
          };
        }
      }

      for (const [ name, options ] of Object.entries(widgets)) {
        result.push({
          name,
          label: options.addLabel || apos.modules[`${name}-widget`]?.label,
          icon: apos.modules[`${name}-widget`]?.icon
        });
      }
      return result;
    },
    areaMeta() {
      const meta = this.convertMetaToItems(this.next.items);
      // Get meta for the area itself
      if (this.meta?.[`@${this.next._id}`]) {
        return {
          ...meta,
          ...this.meta[`@${this.next._id}`]
        };
      }
      return meta;
    }
  },
  methods: {
    getEmptyValue() {
      return {
        metaType: 'area',
        _id: createId(),
        items: []
      };
    },
    watchValue () {
      this.error = this.modelValue.error;
      this.next = this.modelValue.data || this.getEmptyValue();
    },
    validate(value) {
      if (this.field.required) {
        if (!value.items.length) {
          return 'required';
        }
      }
      if (this.field.min) {
        if (value.items.length && (value.items.length < this.field.min)) {
          return 'min';
        }
      }
      if (this.field.max) {
        if (value.items.length && (value.items.length > this.field.max)) {
          return 'max';
        }
      }
      return false;
    },
    changed($event) {
      this.next = {
        ...this.next,
        items: $event.items
      };
    }
  }
};
