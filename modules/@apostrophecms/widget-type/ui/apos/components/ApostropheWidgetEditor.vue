<template>
  <ApostropheModal @close="$emit('close')">
    <template slot="header">
      <!-- TODO i18n -->
      <p>{{ (value ? 'Edit ' : 'New ') + label }}</p>
    </template>
    <template slot="body">
      <AposSchema :schema="schema" v-model="widgetInfo" />
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
    },
    docId: {
      type: String,
      required: false,
      default: null
    }
  },
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
