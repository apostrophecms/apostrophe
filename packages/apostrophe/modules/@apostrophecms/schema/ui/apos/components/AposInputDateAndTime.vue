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
          :id="uid"
          v-model="date"
          class="apos-input apos-input--date"
          :class="classes"
          type="date"
          @change="setDateAndTime"
        >
        <span
          :id="`${uid}-at`"
          class="apos-input--label apos-input--at"
        >
          {{ $t('apostrophe:at') }}
        </span>
        <input
          v-model="time"
          class="apos-input apos-input--time"
          :class="classes"
          type="time"
          :aria-labelledby="`${uid} ${uid}-at`"
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
    container-type: inline-size;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 8px 12px;
  }

  .apos-toggle {
    grid-row: 1;
    grid-column: 1;
  }

  .apos-input {
    padding: 10px;

    &--date,
    &--time {
      grid-column: 2;
      min-width: 0;
    }

    &--date {
      grid-row: 1;
    }

    &--time {
      grid-row: 2;
    }

    &--disabled {
      background-color: var(--a-white);
      border-color: var(--a-base-8);
      color: var(--a-base-2);
    }

    &--at {
      grid-row: 2;
      grid-column: 1;
      justify-self: center;
      font-family: var(--a-family-default);
    }
  }

  @container (min-width: 280px) {
    .apos-input--at {
      grid-row: 1;
      grid-column: 3;
    }

    .apos-input--time {
      grid-row: 1;
      grid-column: 4;
    }
  }
</style>
