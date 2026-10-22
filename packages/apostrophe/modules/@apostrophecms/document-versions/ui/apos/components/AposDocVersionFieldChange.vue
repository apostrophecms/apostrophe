<template>
  <!--
    Takes no box of its own: the change stands where the page rendered the
    value, in the page's own element
  -->
  <!-- eslint-disable vue/no-v-html -->
  <div
    v-if="change.kind === 'richText'"
    class="apos-doc-version-field-change"
    data-apos-test="doc-version-field-change"
    @click.prevent
    v-html="change.markedHtml"
  />
  <!-- eslint-enable vue/no-v-html -->
  <span
    v-else
    class="apos-doc-version-field-change"
    data-apos-test="doc-version-field-change"
  >
    <template
      v-for="(part, index) in change.diff"
      :key="index"
    >
      <template v-if="part.change === 'same'">{{ part.text }}</template>
      <component
        :is="marks[part.change].tag"
        v-else
        :data-apos-version-change="part.change"
      >
        <span class="apos-sr-only">{{ `${$t(marks[part.change].label)} ` }}</span>{{ part.text }}
      </component>
    </template>
  </span>
</template>

<script setup>
// The change of a field rendered in place, where the page renders it: the
// words of a string, removed and added, or the markup of rich text with its
// changed text marked. Its links do not navigate, as in the editor

defineProps({
  // The field's change row: `diff` parts, or `markedHtml` for rich text
  change: {
    type: Object,
    required: true
  }
});

const marks = {
  added: {
    tag: 'ins',
    label: 'apostrophe:versionAddedText'
  },
  removed: {
    tag: 'del',
    label: 'apostrophe:versionRemovedText'
  }
};
</script>

<style lang="scss" scoped>
.apos-doc-version-field-change {
  @include apos-version-change-marks;

  & {
    display: contents;
  }
}
</style>
