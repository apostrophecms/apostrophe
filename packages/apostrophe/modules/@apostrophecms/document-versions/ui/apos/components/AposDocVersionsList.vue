<template>
  <ul class="apos-doc-version-list">
    <li
      v-for="version in versions"
      :key="version._id"
      class="apos-doc-version-list__row"
      data-apos-test="doc-version-item"
      :class="{ 'apos-doc-version-list__row--active': version._id === selectedId }"
    >
      <button
        type="button"
        class="apos-doc-version-list__item"
        data-apos-test="doc-version-action-select"
        :value="version._id"
        :aria-current="version._id === selectedId || undefined"
        @click="$emit('select', version)"
      >
        <span
          class="apos-doc-version-list__avatars"
          aria-hidden="true"
        >
          <span
            v-if="version.ai"
            v-apos-tooltip="'apostrophe:versionAiTooltip'"
            class="apos-doc-version-list__ai"
            data-apos-test="doc-version-ai"
          >
            <creation-icon :size="14" />
          </span>
          <AposAvatar
            v-apos-tooltip="$t('apostrophe:versionEditedBy', { author: version.author })"
            class="apos-doc-version-list__avatar"
            :user="{ _id: version.authorId || version._id, title: version.author }"
          />
        </span>
        <span class="apos-doc-version-list__copy">
          <span
            class="apos-doc-version-list__status"
            :class="`apos-doc-version-list__status--${version.mode}`"
            data-apos-test="doc-version-status"
          >
            {{ $t(`apostrophe:${version.mode}`) }}
          </span>
          <time
            class="apos-doc-version-list__time"
            data-apos-test="doc-version-time"
            :datetime="version.createdAt"
          >
            {{ formatDate(version.createdAt) }}
          </time>
          <span
            class="apos-doc-version-list__meta"
            data-apos-test="doc-version-meta"
          >
            <template
              v-for="part in getMeta(version)"
              :key="part.author ? 'author' : part.text"
            >
              <span
                v-if="part.author"
                class="apos-doc-version-list__author"
              >{{ version.author }}</span>
              <template v-else>
                {{ part.text }}
              </template>
            </template>
          </span>
        </span>
      </button>
      <div
        v-if="version._id === selectedId && $slots.actions"
        class="apos-doc-version-list__actions"
      >
        <slot
          name="actions"
          :version="version"
        />
      </div>
    </li>
  </ul>
</template>

<script setup>
import { computed, inject } from 'vue';
import locale from '../utils/locale.js';

const props = defineProps({
  currentVersion: {
    type: Object,
    default: null
  },
  versions: {
    type: Array,
    required: true
  }
});

defineEmits([ 'select' ]);

const $t = inject('i18n');
const formatDate = locale.getDateFormatter();

const selectedId = computed(() => props.currentVersion?._id || null);

// Keeps the author in its own element whatever its place in the
// translated phrase
const authorMarker = '\u0000';

function getMeta(version) {
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
}
</script>

<style lang="scss" scoped>
$avatar-size: 30px;
$avatar-overlap: 16px;
$avatar-overlap-hover: 10px;
$avatars-width: $avatar-size * 2 - $avatar-overlap;
$item-gap: $spacing-base + $spacing-half;

.apos-doc-version-list {
  @include apos-list-reset();

  & {
    display: block;
    box-sizing: border-box;
    width: 100%;
  }

  &__row {
    @include apos-transition(background-color);

    & {
      border-bottom: 1px solid var(--a-base-8);
    }

    &:hover,
    &--active {
      background-color: var(--a-background-primary);
    }

    &:focus-within {
      box-shadow: inset 0 0 0 1px var(--a-base-7);
    }
  }

  &__item {
    @include apos-button-reset();

    & {
      display: flex;
      gap: $item-gap;
      box-sizing: border-box;
      width: 100%;
      padding: $spacing-base + $spacing-half $spacing-base + $spacing-half
        $spacing-base + $spacing-half $spacing-base;
      outline: none;
      text-align: left;
    }
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

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-base;
    padding: 0 $spacing-base + $spacing-half $spacing-base + $spacing-half
      $spacing-base + $avatars-width + $item-gap;
  }
}
</style>
