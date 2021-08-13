<template>
  <div class="apos-button-group" :class="modifierClass" role="menubar">
    <div class="apos-button-group__inner">
      <slot />
    </div>
  </div>
</template>

<script>

export default {
  name: 'AposButtonGroup',
  props: {
    direction: {
      type: String,
      default: 'horizontal'
    },
    modifiers: {
      type: Array,
      default() {
        return [];
      }
    }
  },
  data() {
    return {
    };
  },
  computed: {
    modifierClass() {
      const modifiers = [];

      if (this.modifiers) {
        this.modifiers.forEach((m) => {
          modifiers.push(`apos-button-group--${m}`);
        });
      }

      return modifiers.join(' ');
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-button-group {
    background-color: var(--a-background-primary);
    border-radius: var(--a-border-radius);
    display: inline-flex;
  }

  .apos-button-group ::v-deep .apos-button {
    background-color: var(--a-background-primary);
    border: none;
    &:hover {
      background-color: var(--a-base-9);
    }
    &:focus {
      background-color: var(--a-base-8);
    }
  }

  .apos-button-group__inner {
    display: flex;
    overflow: hidden;
    padding: 5px;
    border: 1px solid var(--a-background-inverted);
    border-radius: var(--a-border-radius);
    color: var(--a-text-primary);
    background-color: var(--a-background-primary);
  }

  .apos-button-group--vertical .apos-button-group__inner {
    flex-direction: column;
  }

  // group-specific style overrides

  // transform weirds this out
  .apos-button-group ::v-deep .apos-button:hover,
  .apos-button-group ::v-deep .apos-button:focus {
    transform: none;
  }

  // border throws off bounding shell
  .apos-button-group ::v-deep .apos-button:focus {
    border: none;
  }

  // variants
  .apos-button-group--invert {
    .apos-button-group__inner {
      background-color: var(--a-background-inverted);
      color: var(--a-text-inverted);
    }
    & ::v-deep .apos-button {
      border: none;
      background-color: var(--a-background-inverted);
      color: var(--a-text-inverted);
      &:hover {
        background-color: var(--a-base-2);
      }
      &:focus {
        background-color: var(--a-base-3);
      }
    }
  }

  .apos-button-group--theme {
    .apos-button-group__inner {
      background-color: var(--a-background-primary);
      border: 1px solid var(--a-primary-dark-10);
      color: var(--a-primary-dark-10);
    }
    & ::v-deep .apos-button {
      background-color: var(--a-background-primary);
      color: var(--a-primary-dark-10);
      &:hover {
        background-color: var(--a-base-8);
      }
      &:focus {
        background-color: var(--a-base-9);
      }
    }
  }
</style>
