<template>
  <div class="apos-empty-state">
    <p class="apos-title" v-if="emptyState.title">
      {{ emptyState.title }}
    </p>
    <p class="apos-hint" v-if="emptyState.message">
      {{ emptyState.message }}
    </p>
    <div class="apos-emoji" v-if="emptyState.emoji">
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
    @include typeTitle;
    margin: 0 0 10px;
  }

  .apos-hint {
    @include typeMeta;
    font-style: italic;
    color: var(--a-base-1);
    text-align: center;
  }

  .apos-emoji {
    // Variable sizes are less important for icons.
    /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
    font-size: 34px;
  }
</style>
