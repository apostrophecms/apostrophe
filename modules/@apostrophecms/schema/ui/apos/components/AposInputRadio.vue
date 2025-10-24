<template>
  <AposInputWrapper
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :display-options="displayOptions"
    :modifiers="modifiers"
  >
    <template #body>
      <div
        class="apos-radio-wrapper"
        :class="{'apos-radio-wrapper--buttons': field.buttons }"
      >
        <label
          v-for="{label, value, tooltip, icon} in choices"
          :key="value"
          v-apos-tooltip="(field.buttons && !!tooltip) ? $t(tooltip) : null"
          :aria-label="label"
          class="apos-choice-label"
          :for="getChoiceId(uid, value)"
          :class="[
            { 'apos-choice-label--disabled': field.readOnly },
            { 'apos-choice-label--checked': next === value }
          ]"
          tabindex="0"
          @keydown.space="next = value"
        >
          <input
            :id="getChoiceId(uid, value)"
            type="radio"
            class="apos-sr-only apos-input--choice apos-input--radio"
            :value="JSON.stringify(value)"
            :name="field.name"
            :checked="next === value"
            tabindex="0"
            :disabled="field.readOnly"
            @change="change($event.target.value)"
          >
          <span
            v-if="!field.buttons"
            class="apos-input-indicator"
            aria-hidden="true"
          >
            <component
              :is="`${next === value ? 'check-bold-icon' : 'span'}`"
              v-if="next === value"
              :size="8"
            />
          </span>
          <span
            v-if="icon"
            class="apos-choice-label-icon"
          >
            <AposIndicator
              :icon-size="14"
              :icon="icon"
            />
          </span>
          <span
            v-if="label"
            class="apos-choice-label-text"
          >
            {{ $t(label) }}
            <AposIndicator
              v-if="tooltip && !field.buttons"
              class="apos-choice-label-info"
              :tooltip="$t(tooltip)"
              :icon-size="14"
              icon="information-icon"
            />
          </span>
        </label>
      </div>
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

  .apos-choice-label + .apos-choice-label {
    margin: unset;
  }

  .apos-radio-wrapper {
    display: inline-flex;
    flex-direction: column;
    gap: $spacing-base;
  }

  .apos-choice-label {
    &:focus,
    &:active {
      outline: 1px solid var(--a-primary);
    }
  }

  .apos-radio-wrapper--buttons {
    flex-direction: row;
    gap: 0;

    .apos-choice-label-icon {
      margin-left: 0;
    }

    .apos-choice-label:first-of-type {
      border-radius: var(--a-border-radius) 0 0 var(--a-border-radius);
      border-left: 1px solid var(--a-base-8);
    }

    .apos-choice-label:last-of-type {
      border-radius: 0 var(--a-border-radius) var(--a-border-radius) 0;
      border-right: 1px solid var(--a-base-8);
    }

    .apos-choice-label + .apos-choice-label {
      &::before {
        content: '';
        position: absolute;
        left: -0.5px;
        width: 1px;
        height: 50%;
        background-color: var(--a-base-7);
      }
    }

    .apos-choice-label--checked + .apos-choice-label::before,
    .apos-choice-label--checked::before {
      display: none;
    }

    .apos-choice-label {
      position: relative;
      height: 34px;
      padding: 0 $spacing-base;
      border-top: 1px solid var(--a-base-8);
      border-bottom: 1px solid var(--a-base-8);
      background-color: var(--a-base-9);

      &:focus,
      &:active {
        outline-offset: -1px;
      }

      &:hover,
      &--checked {
        background-color: var(--a-base-8);

        // stylelint-disable max-nesting-depth
        .apos-choice-label-icon {
          color: var(--a-black);
        }
      }
    }
    }
</style>
