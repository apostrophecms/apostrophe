<template>
  <AposInputWrapper
    :modifiers="modifiers"
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :display-options="displayOptions"
  >
    <template
      v-if="isMicro"
      #info
    >
      <div
        class="apos-range__value"
        aria-hidden="true"
      >
        <AposIndicator
          v-if="isSet"
          class="apos-range__clear"
          icon="close-icon"
          @click="unset"
        />
        <div class="apos-range__value-input">
          <span v-if="isSet">
            {{ valueLabel }}
          </span>
        </div>
      </div>
    </template>
    <template #body>
      <div class="apos-input-wrapper">
        <div
          v-apos-tooltip="tooltip"
          class="apos-range"
        >
          <input
            :id="uid"
            ref="range"
            v-model.number="next"
            type="range"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            class="apos-range__input"
            :disabled="field.readOnly"
          >
          <div
            v-if="!isMicro"
            class="apos-range__scale"
          >
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
          v-if="!isMicro"
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
  $track-height: 5px;
  $thumb-size: 15px;

  .apos-input-wrapper {
    @include type-base;

    & {
      display: flex;
      place-content: flex-start space-between;
    }
  }

  .apos-range__value {
    min-width: 100px;

    &.apos-is-unset {
      opacity: 0;
      pointer-events: none;
    }

    .apos-field--micro & {
      display: flex;
      padding-top: 0;
      min-width: auto;
    }
  }

  .apos-range__value-input {
    display: inline-flex;
    box-sizing: border-box;
    align-items: center;
    padding: 5px 0 5px 5px;
    border-radius: 5px;
    min-height: 25px;
  }

  .apos-range__clear {
    margin-left: 5px;

    .apos-field--micro & {
      cursor: pointer;
      margin-left: 0;
    }
  }

  .apos-range {
    flex-grow: 1;
    margin-right: 20px;

    .apos-field--micro & {
      margin-right: 0;
    }
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
    height: $track-height;
    margin: 5px 0;
    background: var(--a-base-8);
    background-image: linear-gradient(var(--a-primary), var(--a-primary));
    background-size: 70% 100%;
    background-repeat: no-repeat;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    border-radius: 5px;

    &:focus {
      outline: none;

      & + .apos-range__scale {
        color: var(--a-text-primary);
      }
    }

    &[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .apos-field--micro {
      margin: 0;
    }
  }

  .apos-range__input::-webkit-slider-runnable-track {
    width: 100%;
    height: $track-height;
    border: none;
    background: transparent;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    box-shadow: none;
    border-radius: $track-height;
    cursor: pointer;
  }

  .apos-range__input::-webkit-slider-thumb {
    width: $thumb-size;
    height: $thumb-size;
    margin-top: -4.5px;
    border: 2px solid var(--a-base-7);
    background: var(--a-primary);
    border-radius: $track-height * 2;
    cursor: ew-resize;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
  }

  .apos-range__input:focus::-webkit-slider-runnable-track {
    border: none;
  }

  .apos-range__input::-moz-range-track {
    border-radius: $track-height * 2;
    width: 100%;
    height: $track-height;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .apos-range__input::-moz-range-thumb {
    width: $thumb-size;
    height: $thumb-size;
    border: 2px solid var(--a-base-7);
    background: var(--a-primary);
    border-radius: $track-height * 2;
    cursor: pointer;
  }

  .apos-range__input::-ms-track {
    width: 100%;
    height: $track-height;
    color: transparent;
    background: transparent;
    border-color: transparent;
    border-width: 5.8px 0;
    cursor: pointer;
  }

  .apos-range__input::-ms-fill-lower,
  .apos-range__input::-ms-fill-upper {
    border: 1px solid var(--a-base-4);
    border-radius: 50px;
    background: var(--a-base-7);
  }

  .apos-range__input::-ms-thumb {
    width: $thumb-size;
    height: $thumb-size;
    margin-top: 0;
    border: 1px solid var(--a-base-7);
    background: var(--a-primary);
    border-radius: 1px;
    cursor: pointer;
  }

  .apos-range__input:focus::-ms-fill-lower,
  .apos-range__input:focus::-ms-fill-upper {
    background: var(--a-base-7);
  }

  .apos-field--micro {
    .apos-range__input {
      height: 2px;
    }
  }
</style>
