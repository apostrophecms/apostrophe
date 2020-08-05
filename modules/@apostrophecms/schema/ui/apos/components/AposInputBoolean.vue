<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="error" :uid="uid"
  >
    <template #body>
      <div :class="classList">
        <input
          class="apos-sr-only"
          type="checkbox" :id="`${uid}-true`"
          :value="true" @change="setValue(true)"
          :checked="value.data === true"
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
          class="apos-sr-only apos-boolean__input--false"
          type="checkbox" :id="`${uid}-false`"
          :value="false" @change="setValue(false)"
          :checked="value.data === false"
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
import AposInputMixin from '../mixins/AposInputMixin';

export default {
  name: 'AposBooleanField',
  mixins: [ AposInputMixin ],
  computed: {
    classList: function () {
      return [
        'apos-input-wrapper',
        'apos-boolean',
        {
          'apos-boolean--toggle': this.field.toggle
        }
      ];
    },
    trueLabel: function () {
      if (this.field.toggle && this.field.toggle.true &&
        typeof this.field.toggle.true === 'string') {
        return this.field.toggle.true;
      } else {
        return false;
      }
    },
    falseLabel: function () {
      if (this.field.toggle && this.field.toggle &&
        typeof this.field.toggle.false === 'string') {
        return this.field.toggle.false;
      } else {
        return false;
      }
    }
  },
  methods: {
    setValue(val) {
      this.next = val;
      this.$refs[(!val).toString()].checked = false;
    },
    validate(value) {
      if (this.field.required) {
        if (!value) {
          return 'required';
        }
      }
      return false;
    }
  }
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
    padding: ($boolean-padding / 2) $boolean-padding;

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

    input:checked + & {
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
    input + & {
      &:hover {
        cursor: pointer;
      }

      &:active,
      &:focus {
        background-color: var(--a-base-10);
      }
    }

    input:checked.apos-boolean__input--false + & {
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
  input:focus + label {
    border-color: var(--a-base-2);
    box-shadow: 0 0 5px var(--a-base-6);
  }
</style>
