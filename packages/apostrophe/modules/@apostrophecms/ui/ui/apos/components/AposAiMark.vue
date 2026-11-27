<template>
  <span
    class="apos-ai-mark"
    :class="{ 'apos-ai-mark--labelled': labelled }"
    :data-apos-state="busy ? 'busy' : 'edited'"
    data-apos-test="ai-mark"
  >
    <transition
      name="apos-ai-mark-swap"
      mode="out-in"
    >
      <AposThinkingMark v-if="busy" />
      <span
        v-else-if="labelled"
        class="apos-ai-mark__edited"
      >
        <creation-icon :size="12" />
        {{ $t('apostrophe:versionChangeAi') }}
      </span>
      <span
        v-else
        v-apos-tooltip="$t('apostrophe:editedByAi')"
        class="apos-ai-mark__edited"
        role="img"
        :aria-label="$t('apostrophe:editedByAi')"
        :tabindex="focusable ? 0 : null"
      >
        <creation-icon :size="14" />
      </span>
    </transition>
  </span>
</template>

<script setup>
// What AI does to the thing it stands before: the thinking mark while busy,
// then "Edited by AI"
defineProps({
  busy: {
    type: Boolean,
    default: false
  },
  // Off inside a control that has the focus itself, such as a tab
  focusable: {
    type: Boolean,
    default: true
  },
  // The words next to the icon, where nothing else names the mark
  labelled: {
    type: Boolean,
    default: false
  }
});
</script>

<style lang="scss" scoped>
  .apos-ai-mark {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    vertical-align: middle;
  }

  .apos-ai-mark__edited {
    display: flex;
    border-radius: 2px;
    color: var(--a-primary);

    &:focus-visible {
      outline: 2px solid var(--a-primary);
      outline-offset: 2px;
    }
  }

  .apos-ai-mark--labelled {
    width: auto;
    height: auto;

    .apos-ai-mark__edited {
      align-items: center;
      gap: 4px;
      font-family: var(--a-family-default);
      font-size: var(--a-type-tiny);
      font-weight: var(--a-weight-bold);
      letter-spacing: 0.2px;
      line-height: 1.5;
      white-space: nowrap;
    }
  }

  .apos-ai-mark-swap-enter-active,
  .apos-ai-mark-swap-leave-active {
    transition: opacity 200ms ease-out, transform 200ms ease-out;
  }

  .apos-ai-mark-swap-enter-from,
  .apos-ai-mark-swap-leave-to {
    opacity: 0;
    transform: scale(0.6);
  }

  /* stylelint-disable-next-line media-feature-name-allowed-list */
  @media (prefers-reduced-motion: reduce) {
    .apos-ai-mark-swap-enter-active,
    .apos-ai-mark-swap-leave-active {
      transition: none;
    }
  }
</style>
