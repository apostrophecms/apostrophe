<template>
  <div
    class="apos-assistant-dock"
    :class="`apos-assistant-dock--${tone}`"
    role="status"
    data-apos-test="assistant-dock"
    :data-apos-tone="tone"
  >
    <p class="apos-assistant-dock__title">
      {{ $t(title) }}
    </p>
    <p
      v-if="text"
      class="apos-assistant-dock__text"
    >
      {{ $t(text) }}
    </p>
    <button
      v-if="action"
      type="button"
      class="apos-assistant-dock__action"
      data-apos-test="assistant-dock-action"
      @click="emit('action')"
    >
      {{ $t(action) }}
    </button>
  </div>
</template>

<script setup>
// What the composer waits on, tucked above it: why this browser tab can't
// act here, or why a send was refused
defineProps({
  // `general`: this browser tab can only follow; `warning`: the editor
  // needs to act; `error`: something was refused
  tone: {
    type: String,
    default: 'general'
  },
  title: {
    type: String,
    required: true
  },
  text: {
    type: String,
    default: null
  },
  action: {
    type: String,
    default: null
  }
});
const emit = defineEmits([ 'action' ]);
</script>

<style lang="scss" scoped>
  .apos-assistant-dock {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    // 8px inside the composer's edges, as the prototype's dock sits;
    // the composer tucks 20px over its bottom
    margin: 0 8px -20px;
    padding: 4px 10px 36px;
    border: 1px solid color-mix(in srgb, var(--a-primary) 25%, transparent);
    border-bottom: none;
    border-radius: var(--a-border-radius-large) var(--a-border-radius-large) 0 0;
  }

  .apos-assistant-dock--general {
    border-color: var(--a-base-8);
    background-color: var(--a-base-10);
  }

  .apos-assistant-dock--warning {
    border-color: color-mix(in srgb, var(--a-warning) 55%, var(--a-white));
    background-color: color-mix(in srgb, var(--a-warning) 12%, var(--a-white));
  }

  .apos-assistant-dock--error {
    border-color: color-mix(in srgb, var(--a-danger) 28%, var(--a-white));
    background-color: color-mix(in srgb, var(--a-danger) 5%, var(--a-white));
  }

  .apos-assistant-dock__title,
  .apos-assistant-dock__text {
    @include type-base;

    & {
      margin: 0;
      line-height: var(--a-line-tall);
    }
  }

  .apos-assistant-dock__title {
    padding-top: 6px;
    font-weight: var(--a-weight-bold);
  }

  .apos-assistant-dock__text {
    color: var(--a-base-1);
  }

  .apos-assistant-dock__action {
    @include apos-button-reset();
    @include type-base;

    & {
      align-self: flex-start;
      margin-top: 2px;
      color: var(--a-primary);
      line-height: var(--a-line-tall);
    }

    &:hover {
      text-decoration: underline;
    }

    &:focus-visible {
      border-radius: var(--a-border-radius);
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }
  }
</style>
