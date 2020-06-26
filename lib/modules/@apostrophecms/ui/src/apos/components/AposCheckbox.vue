<template>
  <label
    class="apos-choice-label" :for="id"
    :tabindex="{'-1' : field.hideLabel}"
  >
    <input
      type="checkbox" class="apos-sr-only apos-input--choice apos-input--checkbox"
      :value="choice.value" :name="field.name"
      :id="id" :aria-label="choice.label"
      :tabindex="tabindex" :disabled="status.disabled"
      v-on="{ 'click': status.readOnly ? readOnly : toggle }" :checked="isChecked"
    >
    <span class="apos-input-indicator" aria-hidden="true">
      <component
        :is="`${
          choice.indeterminate ? 'MinusIcon' : 'CheckBoldIcon'
        }`"
        :size="10" v-if="isChecked"
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
import CheckBoldIcon from 'vue-material-design-icons/CheckBold.vue';
import MinusIcon from 'vue-material-design-icons/Minus.vue';

export default {
  components: {
    CheckBoldIcon,
    MinusIcon
  },
  props: {
    choice: {
      type: Object,
      required: true
    },
    field: {
      type: Object,
      required: true
    },
    value: {
      type: Array,
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
  data() {
    return {
      tabindex: this.field.disableFocus ? '-1' : '0'
    };
  },
  computed: {
    isChecked: function () {
      return this.value.includes(this.choice.value);
    }
  },
  methods: {
    readOnly(event) {
      event.preventDefault();
      event.stopPropagation();
      this.$emit('toggle', this.choice.value);
    },
    toggle(event) {
      this.$emit('toggle', this.choice.value);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-input-indicator {
    border-radius: 3px;
  }
</style>
