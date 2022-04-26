<template>
  <div class="apos-input-wrapper">
    <select
      class="apos-input apos-input--select"
      :disabled="isDisabled"
      @change="change($event.target.value)"
    >
      <option
        v-for="choice in choices"
        :key="JSON.stringify(choice.value)"
        :value="JSON.stringify(choice.value)"
      >
        {{ $t(choice.label) }}
      </option>
    </select>
    <AposIndicator
      icon="menu-down-icon"
      class="apos-input-icon"
      :icon-size="20"
    />
  </div>
</template>
<script>

// TODO: use this component in AposInputSelect

export default {
  name: 'AposSelect',
  props: {
    icon: {
      type: String,
      default: 'menu-down-icon'
    },
    choices: {
      type: Array,
      default() {
        return [];
      }
    },
    isDisabled: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'change' ],
  methods: {
    change(value) {
      this.$emit('change', value);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-input-icon {
  @include apos-transition();
}
</style>
