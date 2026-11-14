<template>
  <span
    class="apos-assistant-thinking"
    :role="label ? 'img' : null"
    :aria-label="label || null"
    :aria-hidden="label ? null : 'true'"
    data-apos-test="assistant-thinking"
  >
    <span /><span /><span /><span />
  </span>
</template>

<script setup>
// The thinking mark: four cells pulsing out of step while a request runs.
// Where it is the only sign of that, it carries a label
defineProps({
  label: {
    type: String,
    default: null
  }
});
</script>

<style lang="scss" scoped>
  .apos-assistant-thinking {
    display: grid;
    flex-shrink: 0;
    grid-template-columns: repeat(2, 4px);
    grid-template-rows: repeat(2, 4px);
    gap: 1.5px;
    width: 9.5px;
    height: 9.5px;

    span {
      display: block;
      border-radius: 1px;
      background-color: var(--a-primary);
      opacity: 0.15;
      animation: apos-assistant-thinking ease-in-out infinite;
    }

    span:nth-child(1) {
      animation-duration: 1050ms;
      animation-delay: 120ms;
    }

    span:nth-child(2) {
      animation-duration: 1380ms;
      animation-delay: 510ms;
    }

    span:nth-child(3) {
      animation-duration: 920ms;
      animation-delay: 740ms;
    }

    span:nth-child(4) {
      animation-duration: 1620ms;
      animation-delay: 230ms;
    }
  }

  // Still, the cells keep 3:1 against the panel's backgrounds
  /* stylelint-disable-next-line media-feature-name-allowed-list */
  @media (prefers-reduced-motion: reduce) {
    .apos-assistant-thinking span {
      opacity: 0.65;
      animation: none;
    }
  }

  @keyframes apos-assistant-thinking {
    0%,
    100% {
      opacity: 0.15;
    }

    50% {
      opacity: 0.9;
    }
  }
</style>
