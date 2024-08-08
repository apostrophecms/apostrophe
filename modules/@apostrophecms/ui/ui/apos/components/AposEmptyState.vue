<template>
  <div class="apos-empty-state">
    <p v-if="emptyState.title" class="apos-title">
      {{ $t(emptyState.title) }}
    </p>
    <p v-if="emptyState.message" class="apos-hint">
      {{ $t(emptyState.message) }}
    </p>
    <div v-if="emptyState.emoji" class="apos-emoji">
      {{ emptyState.emoji }}
    </div>
  </div>
</template>

<script>

export default {
  props: {
    emptyState: {
      type: Object,
      required: true
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .apos-title {
    @include type-title;

    & {
      margin: 0 0 10px;
    }
  }

  .apos-hint {
    @include type-base;

    & {
      font-style: italic;
      line-height: var(--a-line-tallest);
      color: var(--a-base-1);
      text-align: center;
    }
  }

  .apos-emoji {
    // Variable sizes are less important for icons.
    /* stylelint-disable-next-line declaration-property-unit-allowed-list */
    font-size: 34px;
  }
</style>
