<template>
  <AposInputWrapper
    :field="field"
    :error="effectiveError" :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <!-- We do not pass docId here because it is solely for
          contextual editing as far as the area editor is concerned. -Tom -->
        <Component
          :is="editorComponent"
          :options="field.options"
          :items="next.items"
          :choices="choices"
          :id="next._id"
          :field-id="field._id"
          @changed="changed"
        />
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>

import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import cuid from 'cuid';

export default {
  name: 'AposInputArea',
  mixins: [ AposInputMixin ],
  data () {
    return {
      next: this.value.data || {
        metaType: 'area',
        _id: cuid(),
        items: []
      },
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
      console.log(Object.entries(this.field.options.widgets));
      for (const [ name, options ] of Object.entries(this.field.options.widgets)) {
        result.push({
          name,
          label: options.addLabel || apos.modules[`${name}-widget`].label
        });
      }
      return result;
    }
  },
  methods: {
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
</script>
