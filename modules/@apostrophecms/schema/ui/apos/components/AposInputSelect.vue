<template>
  <AposInputWrapper
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :modifiers="modifiers"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <select
          class="apos-input apos-input--select" :id="uid"
          @change="change($event.target.value)"
        >
          <option
            v-for="choice in choices" :key="JSON.stringify(choice.value)"
            :value="JSON.stringify(choice.value)"
            :selected="choice.value === value.data"
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
    // Add an null option if there isn't one already
    if (!this.field.required && !this.field.choices.find(choice => {
      return choice.value === null;
    })) {
      this.choices.push({
        label: '',
        value: null
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
    },
    change(value) {
      // Allows expression of non-string values
      this.next = this.choices.find(choice => choice.value === JSON.parse(value)).value;
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-input-icon {
  @include apos-transition();
}
</style>
