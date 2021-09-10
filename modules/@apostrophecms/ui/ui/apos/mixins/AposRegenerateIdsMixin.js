import cuid from 'cuid';

export default {
  methods: {
    // Recursively generates a new id for the given document or widget and all
    // array items and widgets within it. Useful when duplicating a widget
    // or a document
    regenerateIds(schema, object) {
      object._id = cuid();
      for (const field of schema) {
        if (field.type === 'array') {
          for (const item of (object[field.name] || [])) {
            this.regenerateIds(field.schema, item);
          }
        } else if (field.type === 'area') {
          if (object[field.name]) {
            object[field.name]._id = cuid();
            for (const item of (object[field.name].items || [])) {
              const schema = apos.modules[apos.area.widgetManagers[item.type]].schema;
              this.regenerateIds(schema, item);
            }
          }
        }
        // We don't want to regenerate attachment ids. They correspond to
        // actual files, and the reference count will update automatically
      }
    },

  }
}