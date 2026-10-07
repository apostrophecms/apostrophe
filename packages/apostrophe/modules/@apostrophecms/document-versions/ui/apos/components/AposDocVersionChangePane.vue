<template>
  <div
    class="apos-doc-version-changes__pane"
    :class="[
      { 'apos-doc-version-changes__pane--compact': compact },
      `apos-doc-version-changes__pane--${side}`
    ]"
  >
    <div
      v-if="kicker"
      class="apos-doc-version-changes__heading"
    >
      <component
        :is="icon"
        :size="14"
        class="apos-doc-version-changes__value-icon"
        :title="$t(iconTitle)"
      />
      <span
        class="apos-doc-version-changes__kicker"
        :class="`apos-doc-version-changes__kicker--${side}`"
      >
        {{ $t(kicker) }}
      </span>
    </div>
    <div class="apos-doc-version-changes__value-line">
      <component
        :is="icon"
        v-if="!kicker"
        :size="14"
        class="apos-doc-version-changes__value-icon"
        :title="$t(iconTitle)"
      />
      <p
        class="apos-doc-version-changes__value"
        :class="valueClass"
      >
        <slot />
      </p>
    </div>
  </div>
</template>

<script setup>
// One side of a change in the change list: the icon of the side, then the
// value, which is the slot
defineProps({
  side: {
    type: String,
    required: true,
    validator: value => [ 'new', 'old' ].includes(value)
  },
  icon: {
    type: String,
    required: true
  },
  // What the icon says
  iconTitle: {
    type: String,
    required: true
  },
  // The name of the side, above the value
  kicker: {
    type: String,
    default: null
  },
  // A value of a formatting block: no kicker, the icon says the side
  compact: {
    type: Boolean,
    default: false
  },
  valueClass: {
    type: [ String, Object ],
    default: null
  }
});
</script>

<style lang="scss" scoped>
.apos-doc-version-changes {
  &__pane {
    padding: $spacing-half $spacing-base $spacing-base;

    &--new {
      border-bottom: 1px solid var(--a-base-8);
      background-color: color-mix(in srgb, var(--a-success-fade) 45%, var(--a-background-primary));
    }

    &--old {
      background-color: color-mix(in srgb, var(--a-danger-fade) 45%, var(--a-background-primary));
    }
  }

  &__heading {
    display: flex;
    align-items: center;
    gap: $spacing-half;
    margin-bottom: $spacing-half;
  }

  &__kicker {
    font-family: var(--a-family-default);
    font-size: var(--a-type-tiny);
    font-weight: var(--a-weight-bold);
    letter-spacing: 0.2px;
    line-height: 1.55;
    text-transform: uppercase;

    &--new {
      color: var(--a-success-dark);
    }

    &--old {
      color: var(--a-danger-button-hover);
    }
  }

  &__value-line {
    display: flex;
    align-items: center;
    gap: $spacing-half;
  }

  &__value-icon {
    display: flex;
    flex-shrink: 0;

    :deep(.material-design-icon__svg) {
      bottom: 0;
    }

    .apos-doc-version-changes__pane--new & {
      color: var(--a-success-dark);
    }

    .apos-doc-version-changes__pane--old & {
      color: var(--a-danger-button-hover);
    }
  }

  &__value {
    @include type-base;

    & {
      flex: 1 1 auto;
      min-width: 0;
      margin: 0;
      font-size: var(--a-type-smaller);
      line-height: var(--a-line-tall);
      overflow-wrap: anywhere;
    }

    &--new {
      color: var(--a-success-dark);
    }

    &--old {
      color: var(--a-danger-button-hover);
    }

    // Plaintext of rich text has a line for every block
    &--text {
      white-space: pre-line;
    }

    &--clamped {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 8;
      line-clamp: 8;
    }
  }

  // A value of a formatting block: no kicker, the icon says the side
  &__pane--compact {
    padding: $spacing-half $spacing-base;
    border-top: 1px solid var(--a-base-8);
    border-bottom: 0;

    .apos-doc-version-changes__value-line {
      // Keep the icon with the first line of a wrapped value
      align-items: flex-start;
    }
  }
}
</style>
