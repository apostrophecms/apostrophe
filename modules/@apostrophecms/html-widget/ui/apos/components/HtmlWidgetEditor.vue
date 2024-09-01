<template>
  <div :class="{ focused }">
    <!-- Conditionally render the textarea or the HTML preview -->
    <textarea v-if="isEditing"
      class="contextual-html"
      v-model="code"
      placeholder="<p>Add HTML here</p>"
      @blur="toggleEdit">
    </textarea>
    <div v-else @click="toggleEdit" v-html="code" class="html-preview"></div>
  </div>
</template>

<script>
import debounce from 'lodash/debounce';

export default {
  name: 'HtmlWidgetEditor',
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
    docId: {
      type: String,
      required: false,
      default() {
        return null;
      }
    },
    focused: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update', 'context-editing'],
  data() {
    return {
      code: this.modelValue.code || '',
      isEditing: true, // Track whether we're in edit mode or preview mode
      debouncedUpdate: null
    };
  },
  watch: {
    code(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.handleImmediateFeedback();
        this.debouncedUpdate();
      }
    },
    focused(newVal) {
      if (!newVal && this.debouncedUpdate) {
        this.debouncedUpdate.cancel();
        this.emitUpdate();
      }
    }
  },
  created() {
    this.debouncedUpdate = debounce(this.emitUpdate, 1000);
  },
  beforeDestroy() {
    if (this.debouncedUpdate) {
      this.debouncedUpdate.cancel();
    }
  },
  methods: {
    emitUpdate() {
      this.$emit('update', {
        ...this.modelValue,
        code: this.code
      });
    },
    toggleEdit() {
      this.isEditing = !this.isEditing;
    },
    handleImmediateFeedback() {
      if (this.docId === window.apos.adminBar.contextId) {
        this.$emit('context-editing');
      }
    }
  }
};
</script>

<style>
.html-preview {
  cursor: text;
  min-height: 100px; /* Ensure div is clickable when empty */
  border: 1px solid #ccc; /* Visual consistency with textarea */
  padding: 8px; /* Padding for text content */
}
.contextual-html {
  width: 100%; /* Full width */
  min-height: 60px; /* Minimum height to fit 3 lines */
  max-height: 300px; /* Maximum height before scrollbar appears */
  overflow-y: hidden; /* Hide vertical scrollbar */
  resize: vertical; /* Allow vertical resizing */
  border: 1px solid #ccc;
  padding: 8px; /* Consistent padding */
}
</style>
