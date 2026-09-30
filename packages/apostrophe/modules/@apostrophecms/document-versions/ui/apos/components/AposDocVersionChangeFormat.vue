<template>
  <ul
    class="apos-doc-version-changes__format"
    :aria-label="$t('apostrophe:versionFormatting')"
    data-apos-test="doc-version-change-format"
  >
    <li
      v-for="(line, index) in lines"
      :key="index"
      class="apos-doc-version-changes__format-line"
      data-apos-test="doc-version-change-format-line"
      :data-apos-format-change="line.change"
    >
      <div class="apos-doc-version-changes__format-header">
        <span
          class="apos-doc-version-changes__format-label"
          data-apos-test="doc-version-change-format-label"
        >
          <span class="apos-doc-version-changes__format-meta">
            {{ line.label }}
          </span>
          <template v-if="line.text">
            {{ ' ' }}
            <a
              v-if="line.href"
              :href="line.href"
              target="_blank"
              rel="noopener"
              class="apos-doc-version-changes__format-link"
            >
              <q>{{ line.text }}</q>
              <span class="apos-sr-only">{{ $t('apostrophe:versionOpensNewTab') }}</span>
            </a>
            <q v-else>{{ line.text }}</q>
          </template>
        </span>
        <AposDocVersionChangeType :type="line.type" />
      </div>
      <template v-if="line.old || line.new">
        <AposDocVersionChangePane
          v-for="pane in panes"
          :key="pane.side"
          :side="pane.side"
          :icon="pane.icon"
          :icon-title="pane.label"
          :value-class="`apos-doc-version-changes__value--${pane.side}`"
          compact
          :data-apos-test="`doc-version-change-format-${pane.side}`"
        >
          <template v-if="line[pane.side]">
            <a
              v-if="line[pane.side].href"
              :href="line[pane.side].href"
              target="_blank"
              rel="noopener"
              class="apos-doc-version-changes__format-image"
              data-apos-test="doc-version-change-format-image"
            >
              <img
                :src="`${line[pane.side].href}?size=one-sixth`"
                alt=""
              >
              {{ line[pane.side].text }}
              <span class="apos-sr-only">{{ $t('apostrophe:versionOpensNewTab') }}</span>
            </a>
            <template v-else-if="line[pane.side].url">
              <a
                :href="line[pane.side].url"
                target="_blank"
                rel="noopener"
                class="apos-doc-version-changes__format-link"
                data-apos-test="doc-version-change-format-page"
              >
                {{ line[pane.side].text }}
                <span class="apos-sr-only">{{ $t('apostrophe:versionOpensNewTab') }}</span>
              </a>
              <span class="apos-doc-version-changes__format-url">
                {{ line[pane.side].url }}
              </span>
            </template>
            <template v-else>
              {{ line[pane.side].text }}
            </template>
          </template>
          <template v-else>
            <span aria-hidden="true">—</span>
            <span class="apos-sr-only">{{ $t('apostrophe:versionEmptyValue') }}</span>
          </template>
        </AposDocVersionChangePane>
      </template>
    </li>
  </ul>
</template>

<script setup>
// What changed in a rich text besides its words: a block for each change,
// with the two values when it has any
import panes from '../lib/change-panes.js';

defineProps({
  // The `formatChanges` of a row of the `changes` route
  lines: {
    type: Array,
    required: true
  }
});
</script>

<style lang="scss" scoped>
.apos-doc-version-changes {
  &__format {
    @include apos-list-reset();

    & {
      display: flex;
      flex-direction: column;
      gap: $spacing-three-quarters;
    }
  }

  // A box of its own, as the text of the row is
  &__format-line {
    overflow: hidden;
    border: 1px solid var(--a-base-8);
    border-radius: var(--a-border-radius);
  }

  &__format-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-base;
    padding: $spacing-half $spacing-base;

    :deep(.apos-doc-version-change-type) {
      display: none;
    }
  }

  &__format-label {
    @include type-base;

    & {
      min-width: 0;
      font-size: var(--a-type-smaller);
      line-height: var(--a-line-tall);
      overflow-wrap: anywhere;
    }
  }

  &__format-meta {
    color: var(--a-base-2);
    font-style: italic;
  }

  &__format-link {
    color: inherit;

    &:focus-visible {
      outline: 2px solid var(--a-primary);
      outline-offset: 1px;
    }
  }

  // The URL of an internal link, under the title of its document
  &__format-url {
    display: block;
    color: var(--a-base-2);
    font-size: var(--a-type-smaller);
    overflow-wrap: anywhere;
  }

  // An image that can be opened: its thumbnail above its title
  &__format-image {
    display: block;
    width: fit-content;
    color: inherit;

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
}
</style>
