<template>
  <div class="apos-empty-state">
    <div
      v-if="emptyState.icon"
      class="apos-empty-state__icon"
    >
      <AposIndicator
        :icon="emptyState.icon"
        class="apos-empty-state__indicator"
        icon-color="var(--a-base-3)"
        :icon-size="48"
      />
    </div>
    <p
      v-if="emptyState.title"
      class="apos-empty-state__title"
    >
      {{ $t(emptyState.title) }}
    </p>
    <p
      v-if="emptyState.message"
      class="apos-empty-state__message"
    >
      {{ $t(emptyState.message) }}
    </p>
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
    max-width: 450px;
  }

  .apos-empty-state__icon {
    margin-bottom: 10px;
  }

  .apos-empty-state__title {
    @include type-title;

    & {
      margin: 0;
    }
  }

  .apos-empty-state__message {
    @include type-large;

    & {
      margin-top: 5px;
      text-align: center;
    }
  }
</style>
