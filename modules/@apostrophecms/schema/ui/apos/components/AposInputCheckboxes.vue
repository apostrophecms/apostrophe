<template>
  <AposInputWrapper
    :field="field" :error="effectiveError"
    :uid="uid"
    :modifiers="modifiers"
    :display-options="displayOptions"
  >
    <template #body>
      <AposCheckbox
        :for="getChoiceId(uid, choice.value)"
        v-for="choice in choices"
        :key="choice.value"
        :id="getChoiceId(uid, choice.value)"
        :choice="choice"
        :field="field"
        v-model="value.data"
      />
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import AposInputChoicesMixin from 'Modules/@apostrophecms/schema/mixins/AposInputChoicesMixin';

export default {
  name: 'AposInputCheckboxes',
  mixins: [ AposInputMixin, AposInputChoicesMixin ],
  beforeMount: function () {
    this.value.data = Array.isArray(this.value.data) ? this.value.data : [];
  },
  methods: {
    getChoiceId(uid, value) {
      return uid + value.replace(/\s/g, '');
    },
    watchValue () {
      this.error = this.value.error;
      this.next = this.value.data || [];
    },
    validate(values) {
      // The choices and values should always be arrays.
      if (!Array.isArray(this.choices) || !Array.isArray(values)) {
        return 'malformed';
      }

      if (this.field.required && !values.length) {
        return 'required';
      }

      if (this.field.min) {
        if ((values != null) && (values.length < this.field.min)) {
          return 'min';
        }
      }
      if (this.field.max) {
        if ((values != null) && (values.length > this.field.max)) {
          return 'max';
        }
      }

      if (Array.isArray(values)) {
        values.forEach(chosen => {
          if (!this.choices.map(choice => {
            return choice.value;
          }).includes(chosen)) {
            return 'invalid';
          }
        });
      }

      return false;
    }
  }
};
</script>
