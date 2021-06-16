<template>
  <AposInputWrapper
    :field="field"
    :error="effectiveError" :uid="uid"
    :display-options="displayOptions"
    :modifiers="modifiers"
  >
    <template #body>
      <!-- data-apos-schema-area lets all the child areas know that this area is in a schema (which is in a modal)
       and that we should position the z-index of context menus appropriately high -->
      <div
        class="apos-input-wrapper" :class="!next.items.length ? 'apos-is-empty' : null"
        data-apos-schema-area
      >
        <!-- We do not pass docId here because it is solely for
          contextual editing as far as the area editor is concerned. -Tom -->
        <Component
          :is="editorComponent"
          :options="field.options"
          :items="next.items"
          :choices="choices"
          :id="next._id"
          :field-id="field._id"
          :field="field"
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

<style lang="scss" scoped>
  .apos-field--area {
    max-width: $input-max-width;
    .apos-input-wrapper:not(.apos-is-empty) {
      padding: $spacing-base;
      border: 1px solid var(--a-base-8);
      border-radius: var(--a-border-radius);
    }
  }

</style>
