<template>
  <AposInputWrapper
    :modifiers="modifiers"
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :display-options="displayOptions"
    :meta="fieldMeta"
    @replace-field-value="replaceFieldValue"
  >
    <template #body>
      <div class="apos-input-wrapper apos-input-box__wrapper">
        <div
          v-if="mode === 'shorthand'"
          class="apos-input-box__shorthand"
        >
          <input
            :id="`${uid}-shorthand`"
            v-model="shorthand"
            type="number"
            placeholder="--"
            :class="classesShorthand"
            data-apos-test="box-input-all"
            :aria-label="`${$t(field.label)} ${$t('apostrophe:boxFieldAriaLabelAll')}`"
            :disabled="field.readOnly || field.disabled || mode === 'individual'"
            :required="field.required"
            :min="field.min"
            :max="field.max ? field.max : null"
            :step="field.step ? field.step : null"
            :tabindex="tabindex"
            @change="reflectShorthand"
          >
          <div
            v-if="field.unit"
            class="apos-input-box__unit"
          >
            {{ field.unit }}
          </div>
        </div>
        <div
          v-else
          class="apos-input-box__individual"
        >
          <div
            v-for="side in Object.keys(defValue)"
            :key="side"
            class="apos-input-box__individual-input-wrapper"
          >
            <input
              :id="`${uid}-${side}`"
              :ref="`input-side-${side}`"
              v-model="next[side]"
              type="number"
              placeholder="--"
              class="apos-input-box__individual-input apos-input apos-input--number"
              :data-apos-test="`box-input-side-${side}`"
              :aria-label="`${$t(field.label)} ${$t('apostrophe:boxFieldAriaLabelIndividual', { side })}`"
              :class="`apos-input-box__individual-input--${side}`"
              :disabled="field.readOnly || field.disabled"
              :min="field.min"
              :max="field.max ? field.max : null"
              :step="field.step ? field.step : null"
              :required="field.required"
              tabindex="0"
              @focus="individualFocus = side"
              @blur="individualFocus = undefined"
              @input="adjustWidth(side)"
            >
            <label
              class="apos-input-box__individual-label"
              :for="`${uid}-${side}`"
            >
              {{ $t(`apostrophe:boxField${side.charAt(0).toUpperCase() + side.slice(1)}`) }}
            </label>
          </div>
          <div
            v-if="field.unit"
            class="apos-input-box__unit apos-input-box__unit--individual"
          >
            {{ field.unit }}
          </div>
        </div>
        <div class="apos-input-box__controls">
          <div class="apos-input-box__switch">
            <button
              v-apos-tooltip="$t('apostrophe:boxFieldEditAll')"
              class="apos-input-box__switch__button apos-input-box__switch__button--shorthand"
              :class="{'active': mode === 'shorthand'}"
              aria-label="Edit all values"
              data-apos-test="box-mode-button-all"
              @click="mode = 'shorthand'"
            >
              <span class="apos-input-box__switch__box-diagram" />
            </button>
            <button
              v-apos-tooltip="$t('apostrophe:boxFieldEditIndividual')"
              class="apos-input-box__switch__button apos-input-box__switch__button--individual"
              :class="{'active': mode === 'individual'}"
              aria-label="Edit individual values"
              data-apos-test="box-mode-button-individual"
              @click="mode = 'individual'"
            >
              <span
                class="apos-input-box__switch__individual-diagram"
                :class="{ 'has-active': individualFocus }"
              >
                <span
                  v-for="boxSide in Object.keys(defValue)"
                  :key="`box-${boxSide}`"
                  :class="[
                    `apos-input-box__switch__individual-diagram-${boxSide}`,
                    { 'active': individualFocus === boxSide }
                  ]"
                />
              </span>
            </button>
          </div>
          <AposButton
            v-if="hasCustomDef ? !isDef : !isEmpty"
            type="quiet"
            class="apos-input-box__reset"
            :aria-label="hasCustomDef ? $t('apostrophe:reset') : $t('apostrophe:clear')"
            :label="hasCustomDef ? $t('apostrophe:reset') : $t('apostrophe:clear')"
            :action="hasCustomDef ? $t('apostrophe:reset') : $t('apostrophe:clear')"
            :modifiers="['no-motion']"
            @click="clearOrReset"
          />
        </div>
      </div>
    </template>
    <template
      v-if="field.min !== 0 || field.max"
      #info
    >
      <div class="apos-input-box__info">
        <span
          v-if="field.min !== 0"
        >
          Min: {{ field.min }}
        </span>
        <span
          v-if="field.max"
        >
          Max: {{ field.max }}
        </span>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputBoxLogic from '../logic/AposInputBox';
export default {
  name: 'AposInputBox',
  mixins: [ AposInputBoxLogic ]
};
</script>

<style lang="scss" scoped>
  $diagram-dims: 15px;

  :deep(.apos-field__label) {
    flex-direction: column;
    /* stylelint-disable-next-line declaration-no-important */
    align-items: flex-start !important;
    /* stylelint-disable-next-line declaration-no-important */
    gap: 2px !important;
  }

  .apos-input-box__info {
    @include type-small;

    & {
      color: var(--a-base-4);
    }
  }

  .apos-input-box__controls {
    display: flex;
    gap: 7.5px;
  }

  .apos-input-box__wrapper {
    display: flex;
    gap: $spacing-triple;
    max-width: 350px;
  }

  .apos-input--number {
    height: 36px;
    padding: $spacing-base 3px $spacing-base $spacing-base;
  }

  .apos-input-box__shorthand {
    display: flex;
    gap: $spacing-half;
  }

  .apos-input-box__shorthand-input {
    width: 100px;
  }

  .apos-input-box__switch {
    display: flex;
    box-sizing: border-box;
    height: 36px;
    padding: 3px;
    background-color: var(--a-base-9);
    gap: $spacing-half;
    border-radius: var(--a-border-radius);
  }

  .apos-input-box__switch__button {
    display: flex;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    height: 100%;
    aspect-ratio: 1 / 1;
    border: none;
    border-radius: var(--a-border-radius);
    cursor: pointer;
    color: var(--a-base-4);
    background-color: transparent;
    transition: background-color 300ms ease-in;

    &:active, &:focus {
      outline: 2px solid var(--a-primary-transparent-25);
      background-color: var(--a-base-9)
    }

    &:hover:not(.active) {
      background-color: var(--a-base-10);
      outline: 1px solid var(--a-base-6);
    }

    &.active {
      outline: 1px solid var(--a-base-7);
      color: var(--a-primary);
      background-color: var(--a-base-10);
      box-shadow: rgb(50 50 93 / 25%) 0 13px 27px -5px, rgb(0 0 0 / 30%) 0 8px 16px -8px;
    }
  }

  .apos-input-box__switch__box-diagram {
    display: block;
    box-sizing: border-box;
    width: $diagram-dims;
    height: $diagram-dims;
    /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
    border: 2px solid currentcolor;
    border-radius: 3px;
  }

  .apos-input-box__switch__individual-diagram {
    position: relative;
    overflow: hidden;
    width: $diagram-dims;
    height: $diagram-dims;
  }

  [class^='apos-input-box__switch__individual-diagram-'] {
    position: absolute;
    /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
    background-color: currentcolor;
    margin: auto;
  }

  .apos-input-box__switch__individual-diagram.has-active [class^='apos-input-box__switch__individual-diagram-'] {
    background-color: var(--a-base-7);

    &.active {
      background-color: var(--a-primary);
    }
  }

  .apos-input-box__switch__individual-diagram-top,
  .apos-input-box__switch__individual-diagram-bottom {
    right: 0;
    left: 0;
    width: 50%;
    height: 2px;
  }

  .apos-input-box__switch__individual-diagram-right,
  .apos-input-box__switch__individual-diagram-left {
    top: 0;
    bottom: 0;
    width: 2px;
    height: 50%;
  }

  .apos-input-box__switch__individual-diagram-top {
    top: 0;
  }

  .apos-input-box__switch__individual-diagram-bottom {
    bottom: 0;
  }

  .apos-input-box__switch__individual-diagram-right {
    right: 0;
  }

  .apos-input-box__switch__individual-diagram-left {
    left: 0;
  }

  .apos-input-box__reset {
    &.apos-button__wrapper {
      display: contents;
    }
  }

  .apos-input-box__individual-input {
    width: 50px;
    min-width: 50px;
    max-width: 75px;
  }

  .apos-input-box__individual {
    display: flex;
    gap: $spacing-base;
  }

  .apos-input-box__individual-label {
  @include type-help;

    & {
      color: var(--a-base-6);
    }
  }

  .apos-input-box__individual-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: $spacing-half;
    align-items: center;
  }

  .apos-input-box__unit {
    align-self: center;
    // margin-right: $spacing-base + $spacing-half;
    color: var(--a-base-3);
    font-family: var(--a-family-default);
    font-size: var(--a-type-base);
    font-weight: var(--a-weight-base);
    text-transform: uppercase;

    &--individual {
      position: relative;
      top: -5px;
      left: -3px;
    }
  }

</style>
