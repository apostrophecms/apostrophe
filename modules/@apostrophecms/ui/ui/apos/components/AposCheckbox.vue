<template>
  <label
    class="apos-choice-label" :for="id"
    :tabindex="{'-1' : field.hideLabel}"
  >
    <input
      type="checkbox" class="apos-sr-only apos-input--choice apos-input--checkbox"
      :value="choice.value" :name="field.name"
      :id="id" :aria-label="choice.label"
      :tabindex="tabindex" :disabled="field.disabled"
      v-model="checkProxy"
      @change="updateThis"
    >
    <span class="apos-input-indicator" aria-hidden="true">
      <component
        :is="`${
          choice.indeterminate ? 'minus-icon' : 'check-bold-icon'
        }`"
        :size="10" v-if="checked && checked.includes(choice.value)"
      />
    </span>
    <span
      :class="{'apos-sr-only': field.hideLabel }" v-if="choice.label"
      class="apos-choice-label-text"
    >
      {{ choice.label }}
    </span>
  </label>
</template>

<script>

export default {
  // Custom model to handle the v-model connection on the parent.
  model: {
    prop: 'checked',
    event: 'change'
  },
  props: {
    checked: {
      type: [Array, Boolean],
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
      required: true
    },
    id: {
      type: String,
      default: null
    }
  },
  emits: ['change', 'updated'],
  data() {
    return {
      tabindex: this.field.disableFocus ? '-1' : '0'
    };
  },
  computed: {
    // Handle the local check state within this component.
    checkProxy: {
      get() {
        return this.checked;
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
