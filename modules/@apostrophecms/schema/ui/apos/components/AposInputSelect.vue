<template>
  <AposInputWrapper
    :field="field"
    :error="error"
    :uid="uid"
    :modifiers="modifiers"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <select
          class="apos-input apos-input--select" :id="uid"
          v-model="next"
        >
          <option
            v-for="choice in choices" :key="choice.value"
            :value="choice.value"
          >
            {{ choice.label }}
          </option>
        </select>
        <component
          :is="icon" :size="24"
          class="apos-input-icon"
        />
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from '../mixins/AposInputMixin.js';

export default {
  name: 'AposInputSelect',
  mixins: [ AposInputMixin ],
  props: {
    icon: {
      type: String,
      default: 'menu-down-icon'
    }
  },
  data() {
    return {
      choices: []
    };
  },
  mounted() {
    // Add an empty option if there isn't one already or an "any" option.
    if (!this.field.required && !this.field.choices.find(choice => {
      return !choice.value || choice.value === 'any';
    })) {
      this.choices.push({
        label: '',
        value: ''
      });
    }
    this.choices = this.choices.concat(this.field.choices);
  },
  methods: {
    validate(value) {
      if (this.field.required && !value.length) {
        return 'required';
      }

      if (value && !this.field.choices.find(choice => choice.value === value)) {
        return 'invalid';
      }

      return false;
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-input-icon {
  @include apos-transition();
}
</style>
