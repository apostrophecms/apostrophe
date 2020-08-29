<template>
  <AposInputWrapper
    :field="field" :error="error"
    :uid="uid"
  >
    <template #body>
      <label
        class="apos-choice-label" :for="getChoiceId(uid, choice.value)"
        v-for="choice in field.choices" :key="choice.value"
      >
        <input
          type="radio" class="apos-sr-only apos-input--choice apos-input--radio"
          :value="choice.value" :name="field.name"
          :id="getChoiceId(uid, choice.value)"
          v-model="next" :disabled="status.disabled"
          tabindex="1"
        >
        <span class="apos-input-indicator" aria-hidden="true">
          <component
            :is="`${next === choice.value ? 'check-bold-icon' : 'span'}`"
            :size="8" v-if="next === choice.value"
          />
        </span>
        <span class="apos-choice-label-text">
          {{ choice.label }}
        </span>
      </label>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from '../mixins/AposInputMixin';

export default {
  name: 'AposInputRadio',
  mixins: [ AposInputMixin ],
  methods: {
    getChoiceId(uid, value) {
      // Convert any boolean values for this purpose.
      if (typeof value !== 'string') {
        value = !value ? 'undefined' : value.toString();
      }

      value = value.toString();
      // Generate a choice ID, collapsing any whitespace in the value.
      return uid + value.replace(/\s/g, '');
    },
    validate(value) {
      if (this.field.required && (!value || !value.length)) {
        return 'required';
      }

      if (!this.field.choices.map(choice => {
        return choice.value;
      }).includes(value)) {
        return 'invalid';
      }

      return false;
    }
  }
};
</script>

<style lang="scss">
  .apos-input-indicator {
    .apos-input--radio + & {
      border-radius: 50%;
    }
  }
</style>
