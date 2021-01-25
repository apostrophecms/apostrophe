<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="effectiveError" :uid="uid"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <div class="apos-range-input">
          <input
            type="range"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            class="apos-range"
            v-model="next"
            :id="uid"
          >
          <div class="apos-range-input__scale">
            <span class="apos-range-input__scale-value apos-range-input__scale-value--min">
              {{ minLabel }}
            </span>
            <span class="apos-range-input__scale-value apos-range-input__scale-value--max">
              {{ maxLabel }}
            </span>
          </div>
        </div>
        <div class="apos-range-value">
          {{ valueLabel }}
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
    }
  },
  methods: {
    validate(value) {
      if (this.field.required) {
        if (!value) {
          return 'required';
        }
      }
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

  .apos-range-value {
    padding-top: 7px;
    min-width: 40px;
  }

  .apos-range-input {
    flex-grow: 1;
    margin-right: 20px;
  }

  .apos-range-input__scale {
    display: flex;
    justify-content: space-between;
    margin-top: 5px;
  }

  .apos-range-input__scale {
    @include type-small;
    color: var(--a-base-4);
    transition: color 0.5s ease;
  }

  // adapted from http://danielstern.ca/range.css/#/
  .apos-range {
    width: 100%;
    margin: 5px 0;
    background-color: transparent;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    transition: all 0.3s ease;
    &:focus {
      outline: none;
      & + .apos-range-input__scale {
        color: var(--a-text-primary);
      }
    }
  }

  .apos-range::-webkit-slider-runnable-track {
    width: 100%;
    height: 5px;
    border: 1px solid var(--a-base-4);
    background: var(--a-base-7);
    border-radius: 25px;
    cursor: pointer;
  }

  .apos-range::-webkit-progress-value {
    background: var(--a-primary);
  }

  .apos-range::-webkit-slider-thumb {
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

  .apos-range:focus::-webkit-slider-runnable-track {
    border: 1px solid var(--a-base-3);
    background: var(--a-base-6);
  }

  .apos-range::-moz-range-track {
    border-radius: 25px;
    width: 100%;
    height: 5px;
    border: 1px solid var(--a-base-4);
    background: var(--a-base-7);
    cursor: pointer;
  }

  .apos-range::-moz-range-thumb {
    width: 15px;
    height: 15px;
    border: 1px solid var(--a-primary-button-active);
    background: var(--a-primary);
    border-radius: 50%;
    cursor: pointer;
  }

  .apos-range::-ms-track {
    width: 100%;
    height: 5px;
    color: transparent;
    background: transparent;
    border-color: transparent;
    border-width: 5.8px 0;
    cursor: pointer;
  }

  .apos-range::-ms-fill-lower {
    border: 1px solid var(--a-base-4);
    border-radius: 50px;
    background: var(--a-base-7);
  }

  .apos-range::-ms-fill-upper {
    border: 1px solid var(--a-base-4);
    background: var(--a-base-7);
    border-radius: 50px;
  }

  .apos-range::-ms-thumb {
    width: 15px;
    height: 15px;
    border: 1px solid var(--a-primary-button-active);
    border-radius: 1px;
    background: var(--a-primary);
    cursor: pointer;
    margin-top: 0;
    /*Needed to keep the Edge thumb centered*/
  }

  .apos-range:focus::-ms-fill-lower {
    background: var(--a-base-7);;
  }

  .apos-range:focus::-ms-fill-upper {
    background: var(--a-base-7);;
  }

  /*TODO: Use one of the selectors from https://stackoverflow.com/a/20541859/7077589 and figure out
  how to remove the virtical space around the range input in IE*/
  @supports (-ms-ime-align:auto) {
    /* Pre-Chromium Edge only styles, selector taken from hhttps://stackoverflow.com/a/32202953/7077589 */
    .apos-range {
      margin: 0;
      /*Edge starts the margin from the thumb, not the track as other browsers do*/
    }
  }
</style>
