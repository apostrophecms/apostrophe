<template>
  <div class="apos-field__outer">
    <component :is="wrapEl" :class="classList">
      <!-- TODO i18n -->
      <component
        v-if="field.label" :class="{'apos-sr-only': field.hideLabel }"
        class="apos-field-label"
        :is="labelEl" :for="uid"
      >
        {{ field.label }}
        <span v-if="field.required" class="apos-field-required">
          *
        </span>
      </component>
      <!-- TODO i18n -->
      <p v-if="field.help" class="apos-field-help">
        {{ field.help }}
      </p>
      <div v-if="countLabel || minLabel || maxLabel" class="apos-field-limit">
        <span v-if="countLabel">
          {{ countLabel }}
        </span>
        <span v-if="minLabel">
          {{ minLabel }}
        </span>
        <span v-if="maxLabel">
          {{ maxLabel }}
        </span>
      </div>
      <slot name="body" />
      <!-- TODO i18n -->
      <div v-if="errorMessage" class="apos-field-error">
        {{ errorMessage }}
      </div>
    </component>
    <!-- CSS Escape hatch for additional interfaces like relatipnship managers -->
    <slot name="secondary" />
  </div>
</template>

<script>
// A component designed to be used as a scaffold for AposInputString and
// friends, which override the `body` slot
export default {
  name: 'AposInputWrapper',
  props: {
    field: {
      type: Object,
      required: true
    },
    error: {
      type: [ String, Boolean, Object ],
      default: null
    },
    uid: {
      type: Number,
      required: true
    },
    modifiers: {
      type: Array,
      default() {
        return [];
      }
    },
    items: {
      type: Array,
      default() {
        return [];
      }
    }
  },
  data () {
    return {
      wrapEl: 'div',
      labelEl: 'label'
    };
  },
  computed: {
    classList: function () {
      const classes = [
        'apos-field',
        `apos-field-${this.field.type}`,
        `apos-field-${this.field.name}`
      ];
      if (this.field.classes) {
        classes.push(this.field.classes);
      }
      if (this.errorClasses) {
        classes.push(this.errorClasses);
      }
      if (this.modifiers) {
        this.modifiers.forEach((m) => {
          classes.push(`apos-field--${m}`);
        });
      }
      return classes;
    },
    errorClasses: function () {
      if (!this.error) {
        return null;
      }

      let error = 'unknown';

      if (typeof this.error === 'string') {
        error = this.error;
      } else if (this.error.name) {
        error = this.error.name;
      }

      return `apos-field--error apos-field--error-${error}`;
    },
    errorMessage () {
      if (this.error) {
        if (this.error.message) {
          return this.error.message;
        } else {
          return 'Error';
        }
      } else {
        return false;
      }
    },
    countLabel() {
      if (this.field.type === 'relationship') {
        return `${this.items.length} Selected`;
      } else if (this.field.type === 'array') {
        return `${this.items.length} Added`;
      } else {
        return false;
      }
    },
    minLabel() {
      if ((typeof this.field.min) === 'number') {
        return `Min: ${this.field.min}`;
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
    }
  },
  mounted: function () {
    if (this.field.type === 'radio' || this.field.type === 'checkbox') {
      this.wrapEl = 'fieldset';
      this.labelEl = 'legend';
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-field {
    border-width: 0;
    padding: 0;
    [disable]:hover, [disabled] ~ .apos-choice-label-text:hover {
      cursor: not-allowed;
    }
  }

  .apos-field-text {
    font-size: map-get($font-sizes, input-label);
  }

  .apos-field-label {
    display: block;
    padding: 0;
    color: var(--a-text-primary);
    font-size: map-get($font-sizes, input-label);
    font-weight: map-get($font-weights, medium);
  }

  .apos-field-help,
  .apos-field-error {
    margin: $spacing-base 0 0;
    font-size: map-get($font-sizes, input-hint);
    font-weight: 500;
  }

  .apos-field-help {
    color: var(--a-base-3);
  }

  .apos-field-error {
    color: var(--a-danger);
    text-transform: uppercase;
  }

  .apos-field-required {
    color: var(--a-danger);
  }

  .apos-field-limit {
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin: 10px 0;

    span {
      margin-right: 10px;
    }
  }
</style>
