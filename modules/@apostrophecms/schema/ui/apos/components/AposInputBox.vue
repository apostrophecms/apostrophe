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
        <div class="apos-input-box__shorthand">
          <input
            :id="`${uid}-shorthand`"
            v-model="shorthand"
            type="number"
            placeholder="--"
            class="apos-input-box__shorthand-input apos-input apos-input--number"
            :aria-label="`${$t(field.label)} ${$t('apostrophe:boxFieldAriaLabelAll')}`"
            :disabled="field.readOnly || field.disabled || mode === 'individual'"
            :required="field.required"
            :min="field.min"
            :max="field.max ? field.max : null"
            :step="field.step ? field.step : null"
            :tabindex="tabindex"
            @change="reflectShorthand"
          >
          <div class="apos-input-box__switch">
            <button
              v-apos-tooltip="$t('apostrophe:boxFieldEditAll')"
              class="apos-input-box__switch__button apos-input-box__switch__button--shorthand"
              :class="{'active': mode === 'shorthand'}"
              aria-label="Edit all values"
              @click="mode = 'shorthand'"
            >
              <span class="apos-input-box__switch__box-diagram" />
            </button>
            <button
              v-apos-tooltip="$t('apostrophe:boxFieldEditIndividual')"
              class="apos-input-box__switch__button apos-input-box__switch__button--individual"
              :class="{'active': mode === 'individual'}"
              aria-label="Edit individual values"
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
            :modifiers="['no-motion']"
            @click="clearOrReset"
          />
        </div>
        <div
          v-show="mode === 'individual'"
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
    align-items: flex-start !important;
    gap: 2px !important;
  }

  .apos-input-box__info {
    @include type-small;

    & {
      color: var(--a-base-4);
    }
  }

  .apos-input-box__wrapper {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 350px;
  }

  .apos-input--number {
    padding: 10px 3px 10px 10px;
    height: 36px;
  }

  .apos-input-box__shorthand {
    display: flex;
    gap: 10px;
  }

  .apos-input-box__shorthand-input {
    width: 100px;
  }

  .apos-input-box__switch {
    display: flex;
    background-color: var(--a-base-9);
    padding: 5px;
    gap: 5px;
    height: 36px;
    box-sizing: border-box;
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
    transition: all 0.3s ease;

    &:active, &:focus {
      outline: 2px solid var(--a-primary-transparent-50);
    }

    &:hover:not(.active) {
      background-color: var(--a-base-8)
    }

    &.active {
      background-color: var(--a-base-1);
      color: var(--a-base-10);
    }
  }

  .apos-input-box__switch__box-diagram {
    display: block;
    border: 2px solid currentColor;
    width: $diagram-dims;
    height: $diagram-dims;
    border-radius: 3px;
    box-sizing: border-box;
  }

  .apos-input-box__switch__individual-diagram {
    width: $diagram-dims;
    height: $diagram-dims;
    position: relative;
    overflow: hidden;
  }

  [class^='apos-input-box__switch__individual-diagram-'] {
    position: absolute;
    background-color: currentColor;
    margin: auto;
  }

  .apos-input-box__switch__individual-diagram.has-active [class^='apos-input-box__switch__individual-diagram-'] {
    background-color: var(--a-base-3);
    &.active {
      background-color: var(--a-base-10);
    }
  }

  .apos-input-box__switch__individual-diagram-top,
  .apos-input-box__switch__individual-diagram-bottom {
    width: 50%;
    height: 2px;
    left: 0;
    right: 0;
  }

  .apos-input-box__switch__individual-diagram-right,
  .apos-input-box__switch__individual-diagram-left {
    width: 2px;
    height: 50%;
    top: 0;
    bottom: 0;
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
    gap: 10px;
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
    gap: 5px;
    align-items: center;
  }

</style>
