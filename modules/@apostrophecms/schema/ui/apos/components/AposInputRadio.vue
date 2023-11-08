<template>
  <AposInputWrapper
    :field="field" :error="effectiveError"
    :uid="uid"
    :display-options="displayOptions"
    :modifiers="modifiers"
  >
    <template #body>
      <label
        class="apos-choice-label"
        v-for="{label, value, tooltip} in choices"
        :key="value"
        :for="getChoiceId(uid, value)"
        :class="{'apos-choice-label--disabled': field.readOnly}"
      >
        <input
          type="radio"
          class="apos-sr-only apos-input--choice apos-input--radio"
          :id="getChoiceId(uid, value)"
          :value="JSON.stringify(value)"
          :name="field.name"
          :checked="next === value"
          tabindex="1"
          :disabled="field.readOnly"
          @change="change($event.target.value)"
        >
        <span class="apos-input-indicator" aria-hidden="true">
          <component
            v-if="next === value"
            :is="`${next === value ? 'check-bold-icon' : 'span'}`"
            :size="8"
          />
        </span>
        <span class="apos-choice-label-text">
          {{ $t(label) }}
          <AposIndicator
            v-if="tooltip"
            class="apos-choice-label-info"
            :tooltip="tooltip"
            :icon-size="14"
            icon="information-icon"
          />
        </span>
      </label>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputRadioLogic from '../logic/AposInputRadio';
export default {
  name: 'AposInputRadio',
  mixins: [ AposInputRadioLogic ]
};
</script>

<style lang="scss" scoped>
  .apos-input-indicator {
    .apos-input--radio + & {
      border-radius: 50%;
    }
  }
  .apos-choice-label-info {
    position: relative;
    top: 3px;
  }
</style>
