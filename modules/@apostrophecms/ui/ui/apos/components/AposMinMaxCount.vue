<template>
  <div class="apos-min-max-count">
    <span
      v-if="countLabel"
      class="apos-min-max-count__label"
    >
      {{ countLabel }}
    </span>
    <span
      v-if="minLabel"
      :class="minError ? 'has-error' : ''"
      class="apos-min-max-count__label"
    >
      {{ minLabel }}
    </span>
    <span
      v-if="maxLabel"
      :class="maxError ? 'has-error' : ''"
      class="apos-min-max-count__label"
    >
      {{ maxLabel }}
    </span>
  </div>
</template>

<script>

export default {
  name: 'AposMinMaxCount',
  props: {
    value: {
      required: true,
      type: Array
    },
    field: {
      required: true,
      type: Object
    }
  },
  computed: {
    maxed() {
      return (this.field.max !== undefined) && (this.value.length >= this.field.max);
    },
    minError() {
      let minError = false;
      if (this.effectiveMin) {
        if (this.value.length < this.effectiveMin) {
          minError = true;
        }
      }
      return minError;
    },

    maxError() {
      let maxError = false;
      if (this.field.max !== undefined) {
        if (this.value.length > this.field.max) {
          maxError = true;
        }
      }
      return maxError;
    },
    countLabel() {
      return `${this.value.length} Added`;
    },
    // Here in the array editor we use effectiveMin to factor in the
    // required property because there is no other good place to do that,
    // unlike the input field wrapper which has a separate visual
    // representation of "required".
    minLabel() {
      if (this.effectiveMin) {
        return `Min: ${this.effectiveMin}`;
      } else {
        return false;
      }
    },
    maxLabel() {
      if ((typeof this.field.max) === 'number') {
        return `Max: ${this.field.max}`;
      } else {
        return false;
      }
    },
    effectiveMin() {
      if (this.field.min) {
        return this.field.min;
      } else if (this.field.required) {
        return 1;
      } else {
        return 0;
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-min-max-count {
    @include type-help;
    display: flex;
    flex-grow: 1;
    margin-bottom: $spacing-base;
  }

  .has-error {
    color: var(--a-danger);
  }

  .apos-min-max-count__label {
    margin-right: 10px;
  }
</style>
