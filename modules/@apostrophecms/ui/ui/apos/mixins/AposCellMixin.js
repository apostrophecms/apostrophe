export default {
  props: {
    header: {
      type: Object,
      required: true
    },
    draft: {
      type: Object,
      required: true
    },
    published: {
      type: Object,
      default() {
        return null;
      }
    }
  },
  methods: {
    // Access to property or sub-property via dot path. You can also optionally
    // specify a source object other than `item`.
    //
    // `this.get('title')` gets `this.item.title`. `this.get('draft:submitted.by')` gets
    // `this.draft.submitted.by`.
    get(fieldName) {
      let [ namespace, path ] = fieldName.split(':');
      if (!path) {
        path = namespace;
        namespace = 'item';
      }
      const components = path.split('.');
      let value = this[namespace];
      try {
        for (const component of components) {
          value = value[component];
        }
      } catch (e) {
        // Intentionally tolerant, like _.get
        return null;
      }
      return value;
    }
  },
  computed: {
    item() {
      return this.published || this.draft;
    }
  }
};
