<template>
  <AposInputWrapper
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :modifiers="modifiers"
    :display-options="displayOptions"
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
        <AposIndicator
          icon="menu-down-icon"
          class="apos-input-icon"
          :icon-size="20"
        />
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';

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
      next: (this.value.data == null) ? null : this.value.data,
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
