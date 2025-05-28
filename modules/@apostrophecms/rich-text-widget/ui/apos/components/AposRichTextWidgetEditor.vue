<template>
  <AposRichTextEditor
    :options="options"
    :model-value="modelValue"
    :doc-id="docId"
    :id="modelValue._id"
    @update="update" />
</template>

<script>
import AposRichTextEditor from './AposRichTextEditor.vue';

export default {
  name: 'AposRichTextWidgetEditor',
  components: {
    AposRichTextEditor
  },
  props: {
    type: {
      type: String,
      required: true
    },
    options: {
      type: Object,
      required: true
    },
    modelValue: {
      type: Object,
      default() {
        return {};
      }
    },
    // not used, but we need to keep it here to avoid
    // an attribute [object Object]
    meta: {
      type: Object,
      default() {
        return {};
      }
    },
    docId: {
      type: String,
      required: false,
      default() {
        return null;
      }
    },
    // not used, but we need to keep it here to avoid
    // an unnecessary DOM attribute
    focused: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'update' ],
  methods: {
    update(widget) {
      this.$emit('update', widget);
    }
  }
};
</script>
