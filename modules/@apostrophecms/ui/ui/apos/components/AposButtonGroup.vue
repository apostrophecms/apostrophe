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

      modifiers.push(`apos-button-group--${this.direction}`);

      return modifiers;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-button-group {
    background-color: var(--a-background-primary);
    border-radius: 3px;
    display: inline-flex;
  }

  .apos-button-group__inner {
    display: flex;
    border: 1px solid var(--a-base-5);
    border-radius: var(--a-border-radius);
    color: var(--a-text-primary);
    background-color: var(--a-background-primary);
  }

  .apos-button-group--vertical .apos-button-group__inner {
    flex-direction: column;
  }

  // group-specific style overrides

  .apos-button-group /deep/ .apos-button {
    border-radius: 0;
  }

  // transform weirds this out
  .apos-button-group /deep/ .apos-button:hover,
  .apos-button-group /deep/ .apos-button:focus {
    transform: none;
  }

  // border throws off bounding shell
  .apos-button-group /deep/ .apos-button:focus {
    border: none;
  }
</style>
