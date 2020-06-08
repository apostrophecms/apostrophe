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
    value: Object,
    _docId: String,
    _id: String
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
    async save() {
      const widget = this.widgetInfo.data;
      if (!widget.type) {
        widget.type = this.type;
      }
      if (!widget._id) {
        widget._id = cuid();
        this.$emit('insert', widget);
      } else {
        await apos.http.patch(`${apos.docs.action}/${this._docId}`, {
          body: {
            [`@${this._id}`]: this.widgetInfo.data
          }
        });
      }
    }
  }
};
</script>
