<template>
  <label
    class="apos-choice-label"
    :for="id"
    :class="{'apos-choice-label--disabled': field.readOnly}"
    :tabindex="{'-1' : field.hideLabel}"
  >
    <input
      :id="id"
      v-model="checkProxy"
      type="checkbox"
      class="apos-sr-only apos-input--choice apos-input--checkbox"
      :model-value="choice.value"
      :name="field.name"
      :aria-label="choice.label || field.label"
      :tabindex="tabindex"
      :disabled="field.readOnly || choice.readOnly"
      @change="updateThis"
    >
    <span class="apos-input-indicator" aria-hidden="true">
      <component
        :is="`${
          choice.indeterminate ? 'minus-icon' : 'check-bold-icon'
        }`"
        v-if="modelValue && modelValue.includes(choice.value)"
        :size="10"
      />
    </span>
    <span
      v-if="choice.label"
      :class="{'apos-sr-only': field.hideLabel }"
      class="apos-choice-label-text"
    >
      {{ $t(choice.label) }}
    </span>
  </label>
</template>

<script>

export default {
  props: {
    modelValue: {
      type: [ Array, Boolean, String ],
      default: false
    },
    choice: {
      type: Object,
      required: true
    },
    field: {
      type: Object,
      required: true
    },
    status: {
      type: Object,
      default() {
        return {};
      }
    },
    id: {
      type: String,
      default: null
    }
  },
  emits: [ 'change', 'updated' ],
  data() {
    return {
      tabindex: this.field.disableFocus ? '-1' : '0'
    };
  },
  computed: {
    // Handle the local check state within this component.
    checkProxy: {
      get() {
        return this.modelValue;
      },
      set(val) {
        // TODO: Move indeterminate to `status`
        if (!this.choice.indeterminate) {
          // Only update the model if the box was *not* indeterminate.
          this.$emit('change', val);
        }
      }
    }
  },
  methods: {
    // This event is only necessary if the parent needs to do *more* than simply
    // keep track of an array of checkbox values. For example, AposTagApply
    // does extra work with indeterminate values.
    updateThis($event) {
      this.$emit('updated', $event);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-input-indicator {
    border-radius: 3px;
  }
</style>
