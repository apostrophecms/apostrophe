<template>
  <li
    class="apos-doc-version-changes__row"
    data-apos-test="doc-version-change"
    :data-apos-change-type="entry.row.type"
  >
    <component
      :is="entry.detail ? 'button' : 'div'"
      class="apos-doc-version-changes__row-main"
      v-bind="entry.detail ? {
        type: 'button',
        'aria-expanded': expanded ? 'true' : 'false',
        'aria-controls': detailId,
        'data-apos-test': 'doc-version-change-toggle',
        onClick: () => $emit('toggle')
      } : {}"
    >
      <chevron-right-icon
        v-if="entry.detail"
        :size="14"
        class="apos-doc-version-changes__row-chevron"
        :class="{
          'apos-doc-version-changes__row-chevron--open': expanded
        }"
        aria-hidden="true"
      />
      <span
        v-else
        class="apos-doc-version-changes__row-chevron"
      />
      <span class="apos-doc-version-changes__row-lead">
        <AposDocVersionChangePath
          class="apos-doc-version-changes__row-label"
          :class="{
            'apos-doc-version-changes__row-label--meta': entry.order
          }"
          :segments="entry.segments"
          compact
          data-apos-test="doc-version-change-path"
        />
        <span
          v-if="entry.row.ai"
          class="apos-doc-version-changes__row-separator"
          aria-hidden="true"
        >·</span>
        <AposDocVersionAiBadge
          v-if="entry.row.ai"
          v-apos-tooltip="entry.row.ai === 'assisted'
            ? 'apostrophe:versionAiAssistedChangeTooltip'
            : 'apostrophe:versionAiChangeTooltip'"
          :ai="entry.row.ai"
          subtle
          :data-apos-test="entry.row.ai === 'assisted'
            ? 'doc-version-change-ai-assisted'
            : 'doc-version-change-ai'"
        />
      </span>
      <span
        v-if="!entry.detail && !entry.own"
        class="apos-doc-version-changes__row-aside"
      >
        <AposDocVersionChangeType :type="entry.row.type" />
      </span>
    </component>
    <slot name="meta" />
    <div
      v-if="entry.detail && expanded"
      :id="detailId"
      class="apos-doc-version-changes__diff"
      data-apos-test="doc-version-change-diff"
    >
      <div
        v-if="entry.changed"
        class="apos-doc-version-changes__diff-box"
      >
        <AposDocVersionChangeBlock
          v-if="entry.layout === 'block'"
          :key="`block-${revealed}`"
          :entry="entry"
        />
        <AposDocVersionChangeText
          v-else
          :key="`sides-${revealed}`"
          :entry="entry"
          :labels="labels"
        />
      </div>
      <AposDocVersionChangeFormat
        v-if="entry.format.length"
        :lines="entry.format"
        :labels="labels"
      />
    </div>
  </li>
</template>

<script setup>
// An entry of a group of changes: its header, a button that expands its
// detail when it has one, what the `meta` slot adds below it, and the detail
defineProps({
  // An entry of `change-groups.js`
  entry: {
    type: Object,
    required: true
  },
  // Whether the detail shows
  expanded: {
    type: Boolean,
    default: false
  },
  // The detail's id, which the header's button controls
  detailId: {
    type: String,
    required: true
  },
  // Bumped by a reveal: the detail shows its text as when first expanded
  revealed: {
    type: Number,
    default: 0
  },
  // The sides' labels, `{ new, old }`, in place of a version's
  labels: {
    type: Object,
    default: null
  }
});

defineEmits([ 'toggle' ]);
</script>

<style lang="scss" scoped>
$pad-x: $spacing-base + $spacing-half;

.apos-doc-version-changes {
  &__row {
    background-color: var(--a-background-primary);
  }

  // The row's header; a button when the row has a detail to expand
  &__row-main {
    @include apos-button-reset();

    & {
      display: flex;
      box-sizing: border-box;
      align-items: center;
      gap: $spacing-half;
      width: 100%;
      padding: $spacing-half $pad-x;
      text-align: left;
    }
  }

  &__row-main:is(button) {
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--a-primary);
      outline-offset: -2px;
    }
  }

  // Sized for the rows without one too, so the labels line up
  &__row-chevron {
    display: flex;
    flex-shrink: 0;
    width: 14px;
    color: var(--a-base-2);
    transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1);

    :deep(.material-design-icon__svg) {
      bottom: 0;
    }
  }

  &__row-chevron--open {
    transform: rotate(90deg);
  }

  &__row-main:is(button):hover &__row-chevron {
    color: var(--a-text-primary);
  }

  // The field or action, and AI's part in it right after
  &__row-lead {
    display: flex;
    flex: 0 1 auto;
    align-items: baseline;
    gap: $spacing-one-quarter;
    min-width: 0;

    :deep(.apos-doc-version-ai-badge) {
      flex-shrink: 0;
    }
  }

  &__row-separator {
    flex-shrink: 0;
    color: var(--a-base-4);
    font-size: var(--a-type-smaller);
  }

  &__row-label {
    @include type-base;

    & {
      flex: 0 1 auto;
      min-width: 0;
      line-height: var(--a-line-tall);
    }
  }

  &__row-label--meta :deep(.apos-doc-version-change-path__crumb--leaf) {
    color: var(--a-base-2);
    font-style: italic;
  }

  &__row-aside {
    display: flex;
    flex-shrink: 0;
    align-items: baseline;
    justify-content: flex-end;
    gap: $spacing-half;
    margin-left: auto;
  }

  // Each change of the row in a box of its own: the text, then each
  // formatting line
  &__diff {
    display: flex;
    flex-direction: column;
    gap: $spacing-three-quarters;
    padding: $spacing-one-quarter $pad-x $spacing-base;
  }

  &__diff-box {
    overflow: hidden;
    border: 1px solid var(--a-base-8);
    border-radius: var(--a-border-radius);
  }
}
</style>
