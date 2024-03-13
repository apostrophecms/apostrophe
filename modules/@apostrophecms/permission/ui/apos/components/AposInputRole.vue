<template>
  <AposInputWrapper
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :modifiers="modifiers"
    :display-options="displayOptions"
  >
    <template #body>
      <AposSelect
        :id="uid"
        :choices="choices"
        :disabled="field.readOnly"
        :selected="modelValue.data"
        :classes="[ 'apos-input__role' ]"
        :wrapper-classes="[ 'apos-input__role' ]"
        @change="change"
      />
      <AposPermissionGrid :api-params="{ role: next }" />
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';

export default {
  name: 'AposInputRole',
  mixins: [ AposInputMixin ],
  data() {
    return {
      next: (this.modelValue.data == null) ? null : this.modelValue.data,
      choices: []
    };
  },
  async mounted() {
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
    this.$nextTick(() => {
      // this has to happen on nextTick to avoid emitting before schemaReady is
      // set in AposSchema
      if (this.field.required && (this.next == null) && (this.field.choices[0] != null)) {
        this.next = this.field.choices[0].value;
      }
    });
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
      this.next = this.choices.find(choice => choice.value === value).value;
    }
  }
};
</script>
