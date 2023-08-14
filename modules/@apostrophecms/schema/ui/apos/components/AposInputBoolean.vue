<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="effectiveError" :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div :class="classList">
        <input
          class="apos-sr-only apos-boolean__input apos-boolean__input--true"
          type="radio" :id="`${uid}-true`"
          :value="true" @change="setValue(true)"
          :checked="value.data === true"
          :disabled="field.readOnly"
          ref="true"
        >
        <label :for="`${uid}-true`" class="apos-boolean__label apos-input">
          <circle-icon
            :size="12" class="apos-boolean__icon"
            title="" v-show="!field.toggle"
          />
          {{ trueLabel || 'Yes' }}
        </label>
        <input
          class="apos-sr-only apos-boolean__input apos-boolean__input--false"
          type="radio" :id="`${uid}-false`"
          :value="false" @change="setValue(false)"
          :checked="value.data === false"
          :disabled="field.readOnly"
          ref="false"
        >
        <label :for="`${uid}-false`" class="apos-boolean__label apos-input">
          <circle-icon
            :size="12" class="apos-boolean__icon"
            title="" v-show="!field.toggle"
          />
          {{ falseLabel || 'No' }}
        </label>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputBooleanLogic from '../logic/AposInputBoolean';
export default {
  name: 'AposInputBoolean',
  mixins: [ AposInputBooleanLogic ]
};
</script>

<style lang="scss" scoped>
  .apos-boolean {
    z-index: $z-index-base;
    position: relative;
    display: inline-flex;
  }

  .apos-boolean__icon {
    color: var(--a-base-7);
  }

  .apos-boolean__label {
    min-width: 0;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: math.div($boolean-padding, 2) $boolean-padding;

    &:first-of-type {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }

    &:last-of-type {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      margin-left: -1px;
    }

    &:hover,
    &:focus {
      z-index: $z-index-default;
    }

    .apos-boolean__input:checked + & {
      background-color: var(--a-base-10);

      .apos-boolean__icon {
        color: var(--a-success);
      }

      .apos-boolean--toggle &:first-of-type {
        background-color: var(--a-success);
        color: var(--a-white);
      }

      .apos-boolean--toggle &:last-of-type {
        background-color: var(--a-danger);
        color: var(--a-white);
      }

      &:hover,
      &:focus {
        // Prevent border change for active boolean.
        border-color: var(--a-base-4);
      }
    }
    .apos-boolean__input + & {
      &:hover {
        cursor: pointer;
      }

      &:active,
      &:focus {
        background-color: var(--a-base-10);
      }
    }

    .apos-boolean__input:checked.apos-boolean__input--false + & {
      .apos-boolean__icon {
        color: var(--a-danger);
      }
    }
  }

  .apos-boolean__icon {
    display: inline-flex;
    margin-right: $spacing-base;

    svg {
      position: relative;
      top: 1px;
    }
  }
  .apos-boolean__input:focus + .apos-boolean__label {
    border-color: var(--a-base-2);
    box-shadow: 0 0 5px var(--a-base-6);
  }

  .apos-boolean__input[disabled],
  .apos-boolean__input[disabled]:checked {
    & + .apos-boolean__label,
    & + .apos-boolean__label:active {
      color: var(--a-base-4);
      background: var(--a-base-7);
      border-color: var(--a-base-4);
      &:hover {
        cursor: not-allowed;
        border-color: var(--a-base-4);
      }
    }
  }

  .apos-boolean__input[disabled] + .apos-boolean__label .apos-boolean__icon {
    color: var(--a-base-5);
  }

  .apos-boolean--toggle .apos-boolean__input[disabled]:checked {
    & + .apos-boolean__label:first-of-type,
    & + .apos-boolean__label:last-of-type {
      color: var(--a-base-8);
    }
  }

</style>
