<template>
  <ApostropheModal @close="$emit('close')">
    <template slot="header">
      <!-- TODO i18n -->
      <p>{{ (value ? 'Edit ' : 'New ') + label }}</p>
    </template>
    <template slot="body">
      <ApostropheSchemaEditor :fields="schema" v-model="widgetInfo" />
    </template>
    <template slot="footer">
      <slot name="footer">
        <button class="modal-default-button" @click="$emit('close')">
          Cancel
        </button>
        <button v-if="!widgetInfo.hasErrors" class="modal-default-button" @click="save()">
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
    type: String,
    options: Object,
    value: Object
  },
  computed: {
    schema() {
      return this.moduleOptions.schema;
    },
    label() {
      return this.moduleOptions.label;
    },
    moduleOptions() {
      return apos.modules[apos.areas.widgetManagers[this.type]];
    }
  },
  data() {
    return {
      widgetInfo: {
        data: this.value || {},
        hasErrors: false
      }
    };
  },
  methods: {
    save() {
      const widget = this.widgetInfo.data;
      if (!widget._id) {
        widget._id = cuid();
      }
      if (!widget.type) {
        widget.type = this.type;
      }
      this.$emit('input', this.widgetInfo.data);
      this.$emit('save');
    }
  }
};
</script>
