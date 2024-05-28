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
          v-if="!field.required"
          v-model="disabled"
          class="apos-toggle"
          @toggle="toggle"
        />
        <input
          v-model="date"
          class="apos-input apos-input--date"
          :class="{'apos-input--disabled': disabled}"
          type="date"
          @change="setDateAndTime"
        >
        <span class="apos-input--label">
          {{ $t('apostrophe:at') }}
        </span>
        <input
          v-model="time"
          class="apos-input apos-input--time"
          :class="{'apos-input--disabled': disabled}"
          type="time"
          @change="setDateAndTime"
        >
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputDateAndTimeLogic from '../logic/AposInputDateAndTime';
export default {
  name: 'AposInputDateAndTime',
  mixins: [ AposInputDateAndTimeLogic ]
};
</script>
<style scoped lang='scss'>
  .apos-input-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-around;
  }

  .apos-toggle {
    margin-right: 12px;
  }

  .apos-input {
    padding: 10px;

    &--disabled {
      background-color: var(--a-white);
      border-color: var(--a-base-8);
      color: var(--a-base-4);
    }

    &--label {
      margin: 0 12px;
      font-family: var(--a-family-default);
    }
  }
</style>
