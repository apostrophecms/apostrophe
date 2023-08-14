
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import cuid from 'cuid';

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
      next: this.value.data || this.getEmptyValue(),
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
          label: options.addLabel || apos.modules[`${name}-widget`].label
        });
      }
      return result;
    }
  },
  methods: {
    getEmptyValue() {
      return {
        metaType: 'area',
        _id: cuid(),
        items: []
      };
    },
    watchValue () {
      this.error = this.value.error;
      this.next = this.value.data || this.getEmptyValue();
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
