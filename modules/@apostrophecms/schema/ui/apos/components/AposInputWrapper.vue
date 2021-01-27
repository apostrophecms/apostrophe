<template>
  <div class="apos-field__outer">
    <component :is="wrapEl" :class="classList">
      <div class="apos-field-info">
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
          <span
            v-if="field.help && displayOptions.helpTooltip"
            class="apos-field-help-tooltip"
          >
            <AposIndicator
              icon="help-circle-icon"
              class="apos-field-help-icon"
              :tooltip="field.help"
              :icon-size="11"
              icon-color="var(--a-base-4)"
            />
          </span>
        </component>
        <!-- TODO i18n -->
        <p v-if="field.help && !displayOptions.helpTooltip" class="apos-field-help">
          {{ field.help }}
        </p>
        <slot name="additional" />
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
    },
    displayOptions: {
      type: Object,
      default() {
        return {};
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
      if (this.displayOptions && this.displayOptions.helpTooltip) {
        classes.push('apos-field--help-tooltip');
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
        if (typeof this.error === 'string') {
          return this.error;
        } else if (this.error.message) {
          return this.error.message;
        } else {
          return 'Error';
        }
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

</style>
