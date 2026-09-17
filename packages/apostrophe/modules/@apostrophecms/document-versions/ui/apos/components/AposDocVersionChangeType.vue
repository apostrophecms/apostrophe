<template>
  <span
    class="apos-doc-version-change-type"
    :class="`apos-doc-version-change-type--${type}`"
    data-apos-test="doc-version-change-type"
  >
    {{ $t(labels[type]) }}
  </span>
</template>

<script setup>
// Whether a change added, modified or deleted something, as a word, so
// the colour is never the only cue
defineProps({
  type: {
    type: String,
    required: true,
    validator: value => [ 'added', 'modified', 'deleted' ].includes(value)
  }
});

const labels = {
  added: 'apostrophe:versionChangeAdded',
  modified: 'apostrophe:versionChangeModified',
  deleted: 'apostrophe:versionChangeDeleted'
};
</script>

<style lang="scss" scoped>
.apos-doc-version-change-type {
  display: inline-block;
  padding: 2px 6px;
  border-radius: var(--a-border-radius);
  font-family: var(--a-family-default);
  font-size: var(--a-type-tiny);
  font-weight: var(--a-weight-bold);
  letter-spacing: 0.2px;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;

  &--added {
    background-color: var(--a-success-fade);
    color: var(--a-success-dark);
  }

  &--modified {
    background-color: var(--a-warning-fade);
    color: var(--a-warning-dark);
  }

  &--deleted {
    background-color: var(--a-danger-fade);
    color: var(--a-danger-button-hover);
  }
}
</style>
