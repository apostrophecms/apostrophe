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
      :value="choice.value"
      :name="field.name"
      :aria-label="choice.label || field.label"
      :tabindex="tabindex"
      :disabled="field.readOnly || choice.readOnly"
      :is-indeterminate="choice.indeterminate === true ? 'true' : 'false'"
      @change="update"
    >
    <span
      class="apos-input-indicator"
      aria-hidden="true"
    >
      <component
        :is="`${
          choice.indeterminate ? 'minus-icon' : 'check-bold-icon'
        }`"
        v-if="isChecked(modelValue)"
        :size="10"
      />
    </span>
    <div
      v-if="choice.label"
      :class="{'apos-sr-only': field.hideLabel }"
      class="apos-choice-label-text"
    >
      <span>
        {{ $t(choice.label) }}
      </span>
      <!-- eslint-disable vue/no-v-html -->
      <p
        v-if="(choice.help || choice.htmlHelp)"
        class="apos-choice-label-text--help apos-field__help"
        v-html="$t(choice.help || choice.htmlHelp)"
      />
    </div>
  </label>
</template>

<script>

export default {
  props: {
    modelValue: {
      type: [ Array, Boolean ],
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
  emits: [ 'update:modelValue', 'updated' ],
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
        if (!this.choice.indeterminate || this.choice.triggerIndeterminateEvent) {
          // Only update the model if the box was *not* indeterminate.
          this.$emit('update:modelValue', val);
        }
      }
    }
  },
  methods: {
    isChecked(value) {
      return Array.isArray(value)
        ? value.includes(this.choice.value)
        : value;
    },
    // This event is only necessary if the parent needs to do *more* than simply
    // keep track of an array of checkbox values. For example, AposTagApply
    // does extra work with indeterminate values.
    update($event) {
      this.$emit('updated', $event);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-input-indicator {
  border-radius: 3px;
}

.apos-choice-label-text {
  display: inline-flex;
  flex-direction: column;
  align-items: baseline;
}

.apos-field__help {
  @include type-base;

  & {
    margin: 0 0 $spacing-base;
    line-height: var(--a-line-tall);
    color: var(--a-base-3);
  }
}
</style>
