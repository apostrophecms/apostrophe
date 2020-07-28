<template>
  <fieldset :class="cssClass">
    <!-- TODO i18n -->
    <label class="apos-field-label">{{ field.label }}</label>
    <!-- TODO i18n -->
    <div v-if="field.help" class="apos-field-help">{{ field.help }}</div>
    <slot name="body"></slot>
  </fieldset>
</template>

<script>
// A component designed to be used as a scaffold for
// ApostropheStringField and friends, which override the `body`
// slot
export default {
  name: 'ApostropheFieldset',
  props: {
    field: Object,
    error: [ String, Boolean ]
  },
  computed: {
    cssClass() {
      return `apos-field apos-field-${this.field.type} apos-field-${this.field.name} ${this.field.classes} ${this.errorClasses}`;
    },
    errorClasses() {
      if (!this.error) {
        return '';
      }
      return `apos-field-error apos-${this.error}-error`; 
    }
  }
};
</script>