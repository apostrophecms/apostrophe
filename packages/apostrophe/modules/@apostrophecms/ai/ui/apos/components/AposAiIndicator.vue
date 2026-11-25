<template>
  <!-- The AI mark: a four-point sparkle in the primary color on a white disc.
       Named for assistive tech when given a label, hidden from it otherwise
       (when nearby text already says AI is involved) -->
  <span
    class="apos-ai-indicator"
    :class="{ 'apos-ai-indicator--small': small }"
    :role="label ? 'img' : null"
    :aria-label="label ? $t(label) : null"
    :aria-hidden="label ? null : 'true'"
  >
    <svg
      class="apos-ai-indicator__spark"
      viewBox="0 -1.5 24 24"
      aria-hidden="true"
    ><path d="M12 2.5c.36 2.86 1.02 4.84 2.09 5.9C15.16 9.48 17.14 10.14 20 10.5c-2.86.36-4.84 1.02-5.91 2.09C13.02 13.66 12.36 15.64 12 18.5c-.36-2.86-1.02-4.84-2.09-5.91C8.84 11.52 6.86 10.86 4 10.5c2.86-.36 4.84-1.02 5.91-2.1C10.98 7.34 11.64 5.36 12 2.5Z" /></svg>
  </span>
</template>

<script>
export default {
  name: 'AposAiIndicator',
  props: {
    // 20px instead of 26px, for inline use in lists
    small: {
      type: Boolean,
      default: false
    },
    // What it means, for assistive tech, e.g. "with AI"
    label: {
      type: String,
      default: null
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-ai-indicator {
  display: inline-flex;
  box-sizing: border-box;
  flex: 0 0 26px;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--a-base-8);
  color: var(--a-primary);
  background: var(--a-background-primary);
  border-radius: 999px;
}

.apos-ai-indicator__spark {
  width: 18px;
  height: 18px;
  fill: currentcolor;
}

.apos-ai-indicator--small {
  flex-basis: 20px;
  width: 20px;
  height: 20px;
}

.apos-ai-indicator--small .apos-ai-indicator__spark {
  width: 13px;
  height: 13px;
}
</style>
