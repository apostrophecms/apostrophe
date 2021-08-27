<template>
  <span
    class="apos-label" :class="modifiers"
    v-apos-tooltip="tooltip"
  >
    {{ $t(label) }}
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
    &:hover {
      cursor: auto;
    }
  }

  .apos-is-warning {
    border-color: var(--a-warning);
  }

  .apos-is-error {
    border-color: var(--a-danger);
  }

  .apos-is-success {
    border-color: var(--a-success);
  }

  .apos-is-filled {
    background-color: var(--a-base-10);
    color: var(--a-base-1);
  }

  .apos-is-warning.apos-is-filled {
    background-color: var(--a-warning-fade);
  }

  .apos-is-error.apos-is-filled {
    background-color: var(--a-danger-fade);
  }

  .apos-is-success.apos-is-filled {
    background-color: var(--a-success-fade);
  }
</style>
