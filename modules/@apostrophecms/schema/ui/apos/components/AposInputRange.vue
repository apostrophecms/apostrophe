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
        <div v-apos-tooltip="tooltip" class="apos-range">
          <input
            :id="uid"
            v-model="next"
            type="range"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            class="apos-range__input"
            :disabled="field.readOnly"
          >
          <div class="apos-range__scale">
            <span>
              <span class="apos-sr-only">
                {{ $t('apostrophe:minLabel') }}
              </span>
              {{ minLabel }}
            </span>
            <span>
              <span class="apos-sr-only">
                {{ $t('apostrophe:maxLabel') }}
              </span>
              {{ maxLabel }}
            </span>
          </div>
        </div>
        <div
          class="apos-range__value"
          aria-hidden="true"
          :class="{'apos-is-unset': !isSet}"
        >
          {{ valueLabel }}
          <AposButton
            type="quiet"
            label="apostrophe:clear"
            class="apos-range__clear"
            :modifiers="['no-motion']"
            @click="unset"
          />
        </div>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputRangeLogic from '../logic/AposInputRange';
export default {
  name: 'AposInputRange',
  mixins: [ AposInputRangeLogic ]
};
</script>

<style lang="scss" scoped>
  .apos-input-wrapper {
    @include type-base;

    & {
      display: flex;
      place-content: flex-start space-between;
    }
  }

  .apos-range__value {
    padding-top: 7px;
    min-width: 100px;

    &.apos-is-unset {
      opacity: 0;
      pointer-events: none;
    }

    .apos-range__clear {
      margin-left: 5px;
    }
  }

  .apos-range {
    flex-grow: 1;
    margin-right: 20px;
  }

  .apos-range__scale {
    display: flex;
    justify-content: space-between;
    margin-top: 5px;
  }

  .apos-range__scale {
    @include type-small;

    & {
      color: var(--a-base-4);
      transition: color 500ms ease;
    }
  }

  // adapted from http://danielstern.ca/range.css/#/
  .apos-range__input {
    width: 100%;
    margin: 5px 0;
    background-color: transparent;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    transition: all 300ms ease;

    &:focus {
      outline: none;

      & + .apos-range__scale {
        color: var(--a-text-primary);
      }
    }
  }

  .apos-range__input[disabled] {
    cursor: not-allowed;
  }

  .apos-range__input::-webkit-slider-runnable-track {
    width: 100%;
    height: 5px;
    border: 1px solid var(--a-base-4);
    background: var(--a-base-7);
    border-radius: 25px;
    cursor: pointer;
  }

  .apos-range__input::-webkit-progress-value {
    background: var(--a-primary);
  }

  .apos-range__input[disabled]::-webkit-progress-value {
    background: var(--a-primary-light-40);
  }

  .apos-range__input::-webkit-slider-thumb {
    width: 15px;
    height: 15px;
    margin-top: -6px;
    border: 1px solid var(--a-primary-dark-15);
    background: var(--a-primary);
    border-radius: 50%;
    cursor: pointer;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
  }

  .apos-range__input[disabled]::-webkit-slider-thumb {
    background: var(--a-primary-light-40);
  }

  .apos-range__input:focus::-webkit-slider-runnable-track {
    border: 1px solid var(--a-base-3);
    background: var(--a-base-6);
  }

  .apos-range__input::-moz-range-track {
    border-radius: 25px;
    width: 100%;
    height: 5px;
    border: 1px solid var(--a-base-4);
    background: var(--a-base-7);
    cursor: pointer;
  }

  .apos-range__input::-moz-range-thumb {
    width: 15px;
    height: 15px;
    border: 1px solid var(--a-primary-dark-15);
    background: var(--a-primary);
    border-radius: 50%;
    cursor: pointer;
  }

  .apos-range__input[disabled]::moz-range-thumb {
    background: var(--a-primary-light-40);
    cursor: not-allowed;
  }

  .apos-range__input::-ms-track {
    width: 100%;
    height: 5px;
    color: transparent;
    background: transparent;
    border-color: transparent;
    border-width: 5.8px 0;
    cursor: pointer;
  }

  .apos-range__input::-ms-fill-lower {
    border: 1px solid var(--a-base-4);
    border-radius: 50px;
    background: var(--a-base-7);
  }

  .apos-range__input::-ms-fill-upper {
    border: 1px solid var(--a-base-4);
    background: var(--a-base-7);
    border-radius: 50px;
  }

  .apos-range__input::-ms-thumb {
    width: 15px;
    height: 15px;
    margin-top: 0;
    border: 1px solid var(--a-primary-dark-15);
    background: var(--a-primary);
    border-radius: 1px;
    cursor: pointer;
  }

  .apos-range__input[disabled]::-ms-thumb {
    background: var(--a-primary-light-40);
    cursor: not-allowed;
  }

  .apos-range__input:focus::-ms-fill-lower {
    background: var(--a-base-7);
  }

  .apos-range__input:focus::-ms-fill-upper {
    background: var(--a-base-7);
  }
</style>
