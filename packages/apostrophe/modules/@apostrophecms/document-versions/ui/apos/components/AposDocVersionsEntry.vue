<template>
  <span
    class="apos-doc-version-entry"
    :class="`apos-doc-version-entry--${layout}`"
  >
    <span
      class="apos-doc-version-entry__avatars"
      aria-hidden="true"
    >
      <span
        v-if="version.ai"
        v-apos-tooltip="'apostrophe:versionAiTooltip'"
        class="apos-doc-version-entry__ai"
        data-apos-test="doc-version-ai"
      >
        <creation-icon :size="14" />
      </span>
      <AposAvatar
        v-apos-tooltip="$t('apostrophe:versionEditedBy', { author: version.author })"
        class="apos-doc-version-entry__avatar"
        :user="{ _id: version.authorId || version._id, title: version.author }"
      />
    </span>
    <span class="apos-doc-version-entry__copy">
      <span
        class="apos-doc-version-entry__status"
        :class="`apos-doc-version-entry__status--${version.mode}`"
        data-apos-test="doc-version-status"
      >
        {{ $t(`apostrophe:${version.mode}`) }}
      </span>
      <time
        class="apos-doc-version-entry__time"
        data-apos-test="doc-version-time"
        :datetime="version.createdAt"
      >
        {{ formatDate(version.createdAt) }}
      </time>
      <span
        class="apos-doc-version-entry__meta"
        data-apos-test="doc-version-meta"
      >
        <template
          v-for="part in meta"
          :key="part.author ? 'author' : part.text"
        >
          <span
            v-if="part.author"
            class="apos-doc-version-entry__author"
          >{{ version.author }}</span>
          <template v-else>
            {{ part.text }}
          </template>
        </template>
      </span>
    </span>
  </span>
</template>

<script setup>
// One version as the list shows it: who saved it, when, and how many
// edits. The changes panel repeats it above the change list.
import { computed, inject } from 'vue';
import locale from '../utils/locale.js';

const props = defineProps({
  version: {
    type: Object,
    required: true
  },
  // `list` puts the avatars before the copy, `detail` after it
  layout: {
    type: String,
    default: 'list',
    validator: value => [ 'list', 'detail' ].includes(value)
  }
});

const $t = inject('i18n');
const formatDate = locale.getDateFormatter();

// Keeps the author in its own element whatever its place in the
// translated phrase
const authorMarker = '\u0000';

const meta = computed(() => {
  const { version } = props;
  const key = version.changeCount
    ? (version.ai ? 'apostrophe:versionEditsByWithAi' : 'apostrophe:versionEditsBy')
    : (version.ai ? 'apostrophe:versionByWithAi' : 'apostrophe:versionBy');
  const [ before, after = '' ] = $t(key, {
    count: version.changeCount,
    author: authorMarker
  }).split(authorMarker);
  return [
    { text: before },
    { author: true },
    { text: after }
  ].filter(part => part.author || part.text);
});
</script>

<style lang="scss" scoped>
$avatar-size: 30px;
$avatar-overlap: 16px;
$avatar-overlap-hover: 10px;
$avatars-width: $avatar-size * 2 - $avatar-overlap;

.apos-doc-version-entry {
  display: flex;
  gap: $spacing-base + $spacing-half;
  min-width: 0;

  &--detail {
    flex-direction: row-reverse;
  }

  // The AI mark comes first so the avatar, positioned too, paints over it
  &__avatars {
    display: flex;
    flex-direction: row-reverse;
    flex-shrink: 0;
    justify-content: flex-end;
    width: $avatars-width;
    height: $avatar-size;
  }

  &__avatar {
    position: relative;
  }

  // Slides out from under the avatar while the pair is hovered
  &__ai {
    @include apos-transition($what: transform, $duration: 200ms);

    & {
      position: relative;
      display: flex;
      box-sizing: border-box;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: $avatar-size;
      height: $avatar-size;
      margin-left: -$avatar-overlap;
      border: 2px solid var(--a-background-primary);
      border-radius: 50%;
      background-color: var(--a-text-primary);
      color: var(--a-background-primary);
    }
  }

  &__avatars:hover &__ai {
    transform: translateX($avatar-overlap - $avatar-overlap-hover);
  }

  &__copy {
    display: flex;
    flex-direction: column;
    gap: $spacing-half;
    min-width: 0;
  }

  &--detail &__copy {
    flex: 1 1 auto;
  }

  &__status {
    @include type-help;

    & {
      color: var(--a-base-2);
      font-weight: var(--a-weight-bold);
      letter-spacing: 0.4px;
    }

    &--published {
      color: var(--a-success-dark);
    }
  }

  &__time {
    @include type-label;
  }

  &__meta {
    @include type-base;

    & {
      color: var(--a-base-2);
    }
  }

  &__author {
    color: var(--a-base-1);
  }
}
</style>
