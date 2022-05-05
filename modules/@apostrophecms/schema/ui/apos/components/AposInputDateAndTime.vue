<template>
  <AposInputWrapper
    :modifiers="modifiers"
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <AposToggle
          v-model="disabled"
          class="apos-toggle"
          @toggle="toggle"
        />
        <input
          v-model="date"
          class="apos-input apos-input--date"
          type="date"
          :disabled="disabled"
        >
        <span class="apos-input--label">
          {{ $t('apostrophe:at') }}
        </span>
        <input
          v-model="time"
          class="apos-input apos-input--time"
          type="time"
          :disabled="disabled"
        >
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';

export default {
  mixins: [ AposInputMixin ],
  emits: [ 'return' ],
  data() {
    return {
      date: '',
      time: '',
      disabled: true
    };
  },
  methods: {
    toggle() {
      console.log('this.time ===> ', this.time);

      console.log('this.date ===> ', this.date);
      this.disabled = !this.disabled;
    },
    validate() {
      // TODO: validate this field
    }
  }

};
</script>
<style scoped lang='scss'>
  .apos-input-wrapper {
    display: flex;
    justify-content: space-around;
    align-items: center;
  }

  .apos-toggle {
    margin-right: 12px;
  }

  .apos-input {
    padding: 10px;

    &:disabled {
      background-color: var(--a-white);
      border-color: var(--a-base-8);
    }

    &--label {
      margin: 0 12px;
    }
  }
</style>
