<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="effectiveError" :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <input
          type="password"
          class="apos-input apos-input--password"
          v-model="next"
          :placeholder="field.placeholder"
          :disabled="field.disabled"
          :required="field.required"
          :id="uid"
          :tabindex="tabindex"
          @keydown.enter="$emit('return')"
        >
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';

export default {
  name: 'AposInputPassword',
  mixins: [ AposInputMixin ],
  emits: ['return'],
  computed: {
    tabindex () {
      return this.field.disableFocus ? '-1' : '0';
    }
  },
  methods: {
    validate(value) {
      if (this.field.required) {
        if (!value.length) {
          return { message: 'required' };
        }
      }
      if (this.field.min) {
        if (value.length && (value.length < this.field.min)) {
          return { message: `Minimum of ${this.field.min} characters` };
        }
      }
      if (this.field.max) {
        if (value.length && (value.length > this.field.max)) {
          return { message: `Maximum of ${this.field.max} characters` };
        }
      }
      return false;
    }
  }
};
</script>

