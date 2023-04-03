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
        :icon="icon"
        :choices="choices"
        :classes="classes"
        :disabled="field.readOnly"
        :selected="value.data"
        @change="change"
      />
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import AposInputChoicesMixin from 'Modules/@apostrophecms/schema/mixins/AposInputChoicesMixin';

export default {
  name: 'AposInputSelect',
  mixins: [ AposInputMixin, AposInputChoicesMixin ],
  props: {
    icon: {
      type: String,
      default: 'menu-down-icon'
    }
  },
  data() {
    return {
      next: (this.value.data == null) ? null : this.value.data,
      choices: []
    };
  },
  computed: {
    classes () {
      return [ this.value.duplicate && 'apos-input--error' ];
    }
  },
  async mounted() {
    this.prependEmptyChoice();
    this.$nextTick(() => {
      // this has to happen on nextTick to avoid emitting before schemaReady is
      // set in AposSchema
      if (this.field.required && (this.next == null) && (this.choices[0] != null)) {
        this.next = this.choices[0].value;
      }
    });
  },
  methods: {
    validate(value) {
      if (this.field.required && (value === null)) {
        return 'required';
      }

      if (value && !this.choices.find(choice => choice.value === value)) {
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
