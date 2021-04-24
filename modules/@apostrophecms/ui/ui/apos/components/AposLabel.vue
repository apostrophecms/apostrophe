<template>
  <span
    class="apos-label" :class="modifiers"
    v-tooltip="tooltip"
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
    tooltip: {
      type: String,
      default: null
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

  .is-filled {
    background-color: var(--a-base-10);
  }

  .is-warning.is-filled {
    background-color: var(--a-warning-fade);
    color: var(--a-base-1);
  }

  .is-subtle {
    opacity: 0.75;
  }
</style>
