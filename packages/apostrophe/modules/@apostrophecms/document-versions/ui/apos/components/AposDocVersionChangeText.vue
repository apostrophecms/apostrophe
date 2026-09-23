<template>
  <AposDocVersionChangePane
    v-for="pane in panes"
    :key="pane.side"
    ref="paneRefs"
    :side="pane.side"
    :icon="pane.icon"
    :icon-title="pane.markLabel"
    :kicker="pane.label"
    :value-class="{
      [`apos-doc-version-changes__value--${pane.side}`]: entry.order,
      'apos-doc-version-changes__value--text': !entry.order && !entry.images[pane.side],
      'apos-doc-version-changes__value--clamped': !full && !entry.images[pane.side]
    }"
    :data-apos-test="`doc-version-change-${pane.side}`"
  >
    <template v-if="entry.images[pane.side]">
      <a
        v-for="(image, index) in entry.images[pane.side]"
        :key="index"
        :href="image.href"
        target="_blank"
        rel="noopener"
        class="apos-doc-version-changes__image"
        data-apos-test="doc-version-change-image"
        :data-apos-image-change="image.change"
      >
        <img
          :src="`${image.href}?size=one-sixth`"
          alt=""
        >
        <component
          :is="pane.tag"
          v-if="image.change !== 'same'"
          class="apos-doc-version-changes__mark"
          :class="`apos-doc-version-changes__mark--${pane.side}`"
        >
          <span class="apos-sr-only">{{ `${$t(pane.markLabel)} ` }}</span>{{ image.text }}
        </component>
        <template v-else>
          {{ image.text }}
        </template>
        <span class="apos-sr-only">{{ $t('apostrophe:versionOpensNewTab') }}</span>
      </a>
    </template>
    <template v-else-if="entry.text[pane.side]">
      <template
        v-for="(part, index) in parts[pane.side]"
        :key="index"
      >
        <span v-if="entry.order && index">, </span>
        <span v-if="part.change === 'same'">{{ part.text }}</span>
        <template v-else-if="part.change === 'elided'">
          <span
            class="apos-doc-version-changes__elided"
            aria-hidden="true"
          > … </span>
          <span class="apos-sr-only">{{ ` ${$t('apostrophe:versionUnchangedOmitted')} ` }}</span>
        </template>
        <component
          :is="pane.tag"
          v-else
          class="apos-doc-version-changes__mark"
          :class="`apos-doc-version-changes__mark--${pane.side}`"
        >
          <span class="apos-sr-only">{{ `${$t(pane.markLabel)} ` }}</span>{{ part.text }}
        </component>
      </template>
    </template>
    <template v-else>
      <span
        class="apos-doc-version-changes__none"
        :class="`apos-doc-version-changes__none--${pane.side}`"
        aria-hidden="true"
      >—</span>
      <span class="apos-sr-only">{{ $t('apostrophe:versionEmptyValue') }}</span>
    </template>
  </AposDocVersionChangePane>
  <div
    v-if="entry.elided || clamped || full"
    class="apos-doc-version-changes__more"
  >
    <AposButton
      class="apos-doc-version-changes__more-toggle"
      type="quiet"
      :label="full
        ? 'apostrophe:versionShowLessText'
        : 'apostrophe:versionShowFullText'"
      :attrs="{
        'aria-pressed': full,
        'data-apos-test': 'doc-version-change-full'
      }"
      @click="full = !full"
    />
  </div>
</template>

<script setup>
// The words of a change: what each side shows, with the long unchanged runs
// cut down and the text cut short by its height, until the full text is
// asked for
import {
  computed, nextTick, onMounted, ref
} from 'vue';
import panes from '../lib/change-panes.js';

const props = defineProps({
  // An entry of a change group
  entry: {
    type: Object,
    required: true
  }
});

const paneRefs = ref([]);
// Whether the text shows in full, and whether its height cut it short
const full = ref(false);
const clamped = ref(false);

const parts = computed(() => (full.value ? props.entry.parts : props.entry.short));

onMounted(async () => {
  await nextTick();
  clamped.value = paneRefs.value.some(pane => {
    const value = pane.$el.querySelector('.apos-doc-version-changes__value--clamped');
    return value && (value.scrollHeight > value.clientHeight + 1);
  });
});
</script>

<style lang="scss" scoped>
.apos-doc-version-changes {
  &__elided {
    color: var(--a-base-2);
  }

  &__more {
    display: flex;
    justify-content: flex-end;
    padding: $spacing-one-quarter $spacing-base;
    border-top: 1px solid var(--a-base-8);
  }

  &__more-toggle :deep(.apos-button) {
    font-size: var(--a-type-smaller);
    transform: none;

    &:hover:not([disabled]),
    &:focus:not([disabled]) {
      transform: none;
    }
  }

  &__mark {
    text-decoration-thickness: 1px;

    &--new {
      color: var(--a-success-dark);
      text-decoration-line: underline;
    }

    &--old {
      color: var(--a-danger-button-hover);
      text-decoration-line: line-through;
    }
  }

  // A related image that can be opened: its thumbnail above its title
  &__image {
    display: block;
    width: fit-content;
    color: inherit;

    & + & {
      margin-top: $spacing-base;
    }

    &:focus-visible {
      outline: 2px solid var(--a-primary);
      outline-offset: 1px;
    }

    img {
      display: block;
      max-width: 120px;
      height: 64px;
      margin-bottom: $spacing-half;
      border: 1px solid var(--a-base-8);
      border-radius: var(--a-border-radius);
      background-color: var(--a-base-9);
      object-fit: contain;
    }

    &:hover img {
      border-color: var(--a-base-5);
    }
  }

  // The side with no value, in its side's colour without a line
  &__none {
    &--new {
      color: var(--a-success-dark);
    }

    &--old {
      color: var(--a-danger-button-hover);
    }
  }
}
</style>
