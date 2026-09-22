<template>
  <span
    class="apos-doc-version-change-type"
    :class="`apos-doc-version-change-type--${type}`"
    data-apos-test="doc-version-change-type"
  >
    <AposIndicator
      v-if="icon"
      class="apos-doc-version-change-type__icon"
      :icon="icons[type]"
      :icon-size="10"
    />
    {{ $t(changeTypes.labels[type]) }}
  </span>
</template>

<script setup>
// Whether a change added, modified, deleted or moved something, as a
// word, so the colour is never the only cue
import changeTypes from '../lib/change-types.js';

defineProps({
  type: {
    type: String,
    required: true,
    validator: value => [ 'added', 'modified', 'deleted', 'moved' ].includes(value)
  },
  // An icon before the word, for a marker on the content itself
  icon: {
    type: Boolean,
    default: false
  }
});

const icons = {
  added: 'plus-icon',
  modified: 'pencil-icon',
  deleted: 'minus-icon',
  moved: 'cursor-move-icon'
};
</script>

<style lang="scss" scoped>
.apos-doc-version-change-type {
  display: inline-block;
  box-sizing: border-box;
  padding: 2px 6px;
  border: 1px solid color-mix(in srgb, currentcolor 50%, transparent);
  border-radius: var(--a-border-radius);
  font-family: var(--a-family-default);
  font-size: var(--a-type-tiny);
  font-weight: var(--a-weight-bold);
  letter-spacing: 0.2px;
  line-height: 1.5;
  text-transform: uppercase;
  white-space: nowrap;

  &__icon {
    margin-right: 2px;
    vertical-align: -1px;
  }

  // Opaque tints, so the contrast of the text does not depend on the
  // header, frame or highlight the badge sits on (a11y contrast)
  &--added {
    background-color: color-mix(in srgb, var(--a-success) 19%, var(--a-background-primary));
    color: var(--a-success-dark);
  }

  &--modified {
    background-color: color-mix(in srgb, var(--a-warning) 19%, var(--a-background-primary));
    color: var(--a-warning-dark);
  }

  &--deleted {
    background-color: color-mix(in srgb, var(--a-danger) 19%, var(--a-background-primary));
    color: var(--a-danger-button-hover);
  }

  &--moved {
    background-color: color-mix(in srgb, var(--a-brand-blue) 12%, var(--a-background-primary));
    color: color-mix(in srgb, var(--a-brand-blue) 65%, #000);
  }
}
</style>
