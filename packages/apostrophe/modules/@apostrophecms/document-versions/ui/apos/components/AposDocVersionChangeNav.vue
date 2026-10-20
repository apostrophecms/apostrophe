<template>
  <nav
    class="apos-doc-version-changes__nav"
    :aria-label="$t('apostrophe:versionNavLabel')"
    data-apos-test="doc-version-changes-nav"
  >
    <div
      class="apos-doc-version-changes__nav-status"
      aria-live="polite"
      aria-atomic="true"
    >
      <AposDocVersionChangePath
        v-if="path"
        class="apos-doc-version-changes__nav-label"
        :segments="path"
        compact
        data-apos-test="doc-version-changes-nav-label"
      />
      <span
        v-else
        class="apos-doc-version-changes__nav-label"
        data-apos-test="doc-version-changes-nav-label"
      >{{ $t('apostrophe:versionNavLabel') }}</span>
      <span
        class="apos-doc-version-changes__nav-position"
        data-apos-test="doc-version-changes-nav-position"
      >
        {{ $t(positionLabel, {
          current: position + 1,
          total,
          count: total
        }) }}
      </span>
      <slot />
    </div>
    <div class="apos-doc-version-changes__nav-buttons">
      <AposButton
        ref="previousButton"
        type="outline"
        icon="chevron-left-icon"
        icon-only
        label="apostrophe:versionNavPrevious"
        tooltip="apostrophe:versionNavPrevious"
        :modifiers="[ 'small' ]"
        :disabled="position <= 0"
        :attrs="{ 'data-apos-test': 'doc-version-changes-nav-previous' }"
        @click="$emit('step', -1)"
      />
      <AposButton
        ref="nextButton"
        type="outline"
        icon="chevron-right-icon"
        icon-only
        label="apostrophe:versionNavNext"
        tooltip="apostrophe:versionNavNext"
        :modifiers="[ 'small' ]"
        :disabled="position === total - 1"
        :attrs="{ 'data-apos-test': 'doc-version-changes-nav-next' }"
        @click="$emit('step', 1)"
      />
    </div>
  </nav>
</template>

<script setup>
// The change navigator's bar: the selected group's breadcrumb, its position
// among the groups, and the Previous and Next buttons. The default slot adds
// to what the live region announces.
import { ref } from 'vue';

defineProps({
  // The breadcrumb of the selected group, `null` until one is selected
  path: {
    type: Array,
    default: null
  },
  // The index of the selected group, -1 until one is selected
  position: {
    type: Number,
    required: true
  },
  // How many groups there are
  total: {
    type: Number,
    required: true
  },
  // The i18n key of the position line, given `current`, `total` and `count`
  positionLabel: {
    type: String,
    default: 'apostrophe:versionNavPosition'
  }
});

// `step` carries -1 for Previous and 1 for Next
defineEmits([ 'step' ]);

const previousButton = ref(null);
const nextButton = ref(null);

// Focuses the `previous` or the `next` button
function focus(button) {
  const target = button === 'previous' ? previousButton : nextButton;
  target.value?.$el.querySelector('button')?.focus();
}

defineExpose({
  focus
});
</script>

<style lang="scss" scoped>
$pad-x: $spacing-base + $spacing-half;

.apos-doc-version-changes {
  &__nav {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-base;
    padding: $spacing-base $pad-x;
    border-top: 1px solid var(--a-base-8);
    background-color: var(--a-base-10);
  }

  &__nav-status {
    @include type-base;

    & {
      display: flex;
      flex-direction: column;
      min-width: 0;
      line-height: var(--a-line-tall);
    }
  }

  &__nav-label {
    font-size: var(--a-type-large);
    font-weight: 600;
  }

  &__nav-position {
    color: var(--a-base-1);
    font-size: var(--a-type-smaller);
  }

  &__nav-buttons {
    display: flex;
    flex-shrink: 0;
    gap: $spacing-half;
  }

  // Light on the bar; a disabled one fades into it
  &__nav-buttons :deep(.apos-button) {
    border-color: var(--a-base-8);
    color: var(--a-base-1);
    background-color: var(--a-background-primary);

    &:hover:not([disabled]) {
      color: var(--a-text-primary);
      background-color: var(--a-base-10);
    }

    &[disabled] {
      border-color: var(--a-base-9);
      color: var(--a-base-6);
      background-color: transparent;
    }
  }
}
</style>
