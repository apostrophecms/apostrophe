<template>
  <ApostropheModal @close="close">
    <template #header>
      <!-- TODO i18n -->
      <p>{{ (value ? 'Edit ' : 'New ') + label }}</p>
    </template>
    <template #body>
      <AposSchema :schema="schema" v-model="widgetInfo" />
    </template>
    <template #footer>
      <slot name="footer">
        <button class="modal-default-button" @click="close">
          Cancel
        </button>
        <button
          v-if="!widgetInfo.hasErrors" class="modal-default-button"
          @click="save()"
        >
          Save
        </button>
      </slot>
    </template>
  </ApostropheModal>
</template>

<script>

import cuid from 'cuid';

export default {
  name: 'ApostropheWidgetEditor',
  props: {
    type: {
      required: true,
      type: String
    },
    options: {
      required: true,
      type: Object
    },
    value: {
      required: false,
      type: Object,
      default() {
        return {};
      }
    }
  },
  emits: [ 'close', 'insert', 'update' ],
  data() {
    return {
      id: this.value && this.value._id,
      widgetInfo: {
        data: this.value || {},
        hasErrors: false
      }
    };
  },
  computed: {
    schema() {
      return this.moduleOptions.schema;
    },
    label() {
      return this.moduleOptions.label;
    },
    moduleOptions() {
      return apos.modules[apos.area.widgetManagers[this.type]];
    }
  },
  methods: {
    async close() {
      const widget = this.widgetInfo.data;
      if (!widget.type) {
        widget.type = this.type;
      }
      this.$emit('close', widget);
    },
    async save() {
      const widget = this.widgetInfo.data;
      if (!widget.type) {
        widget.type = this.type;
      }
      if (!this.id) {
        widget._id = cuid();
        this.$emit('insert', widget);
      } else {
        widget._id = this.id;
        this.$emit('update', widget);
      }
    }
  }
};
</script>
