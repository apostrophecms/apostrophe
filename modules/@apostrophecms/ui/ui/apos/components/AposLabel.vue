<template>
  <span
    class="apos-label" :class="modifiers"
  >
    {{ label }}
  </span>
</template>

<script>
export default {
  name: 'AposLabel',
  props: {
    label: {
      type: String,
      required: true
    },
    modifiers: {
      type: Array,
      default() {
        return [];
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-label {
    display: inline-block;
    padding: 5px;
    border: 1px solid var(--a-base-8);
    border-radius: var(--a-border-radius);
    font-size: var(--a-type-tiny);
  }

  .is-warning {
    border-color: var(--a-warning);
  }

  .is-error {
    border-color: var(--a-danger);
  }
</style>
