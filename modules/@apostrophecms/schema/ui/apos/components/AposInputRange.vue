<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="effectiveError" :uid="uid"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <div class="apos-range">
          <input
            type="range"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            class="apos-range__input"
            v-model="next"
            :id="uid"
          >
          <div class="apos-range__scale">
            <span>
              <span class="apos-sr-only">
                Min:
              </span>
              {{ minLabel }}
            </span>
            <span>
              <span class="apos-sr-only">
                Max:
              </span>
              {{ maxLabel }}
            </span>
          </div>
        </div>
        <div
          class="apos-range__value"
          aria-hidden="true"
          :class="{'is-unset': !isSet}"
        >
          {{ valueLabel }}
          <AposButton
            type="quiet" label="Clear"
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
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';

export default {
  name: 'AposInputRange',
  mixins: [ AposInputMixin ],
  data() {
    return {
      unit: this.field.unit || ''
    };
  },
  computed: {
    minLabel() {
      return this.field.min + this.unit;
    },
    maxLabel() {
      return this.field.max + this.unit;
    },
    valueLabel() {
      return this.next + this.unit;
    },
    isSet() {
      // Detect whether or not a range is currently unset
      // Use this flag to hide/show UI elements
      if (this.next >= this.field.min) {
        return true;
      } else {
        return false;
      }
    }
  },
  mounted() {
    // The range spec defaults to a value of midway between the min and max
    // Example: a range with an unset value and a min of 0 and max of 100 will become 50
    // This does not allow ranges to go unset :(
    if (!this.next) {
      this.unset();
    }
  },
  methods: {
    // Default to a value outside the range, to be used as a flag.
    // The value will be set to null later in validation
    unset() {
      this.next = this.field.min - 1;
    },
    validate(value) {
      if (this.field.required) {
        if (!value) {
          return 'required';
        }
      }
      return false;
    },
    convert(value) {
      return parseFloat(value);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-input-wrapper {
    @include type-base;
    display: flex;
    justify-content: space-between;
    align-content: flex-start;
  }

  .apos-range__value {
    padding-top: 7px;
    min-width: 100px;
    &.is-unset {
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
    color: var(--a-base-4);
    transition: color 0.5s ease;
  }

  // adapted from http://danielstern.ca/range.css/#/
  .apos-range__input {
    width: 100%;
    margin: 5px 0;
    background-color: transparent;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    transition: all 0.3s ease;
    &:focus {
      outline: none;
      & + .apos-range__scale {
        color: var(--a-text-primary);
      }
    }
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

  .apos-range__input::-webkit-slider-thumb {
    margin-top: -6px;
    width: 15px;
    height: 15px;
    border: 1px solid var(--a-primary-button-active);
    border-radius: 50%;
    background: var(--a-primary);
    cursor: pointer;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
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
    border: 1px solid var(--a-primary-button-active);
    background: var(--a-primary);
    border-radius: 50%;
    cursor: pointer;
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
    border: 1px solid var(--a-primary-button-active);
    border-radius: 1px;
    background: var(--a-primary);
    cursor: pointer;
    margin-top: 0;
  }

  .apos-range__input:focus::-ms-fill-lower {
    background: var(--a-base-7);;
  }

  .apos-range__input:focus::-ms-fill-upper {
    background: var(--a-base-7);;
  }
</style>
