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
        class="apos-doc-version-list__item"
        data-apos-test="doc-version-action-select"
        :value="version._id"
        @click="$emit('select', version)"
      >
        <span class="apos-doc-version-list__title">
          {{ toHumanDate(version.createdAt) }}
        </span>
        <p class="apos-doc-version-list__info">
          <span class="apos-doc-version-list__author">
            {{ version.author }}
          </span>
          <span class="apos-doc-version-list__published-times">
            {{ displayChangeCount(version.changeCount) }}
          </span>
        </p>
      </button>
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
const dateTimeFormat = locale.getDateTimeFormat();

const selectedId = computed(() => props.currentVersion?._id || null);

function toHumanDate(date) {
  return dateTimeFormat.format(new Date(date));
}

function displayChangeCount(changeCount) {
  if (!changeCount) {
    return null;
  }
  return $t('apostrophe:publishedEdit', { count: changeCount });
}
</script>

<style lang="scss" scoped>

.apos-doc-version-list {
  @include apos-list-reset();

  & {
    display: block;
    box-sizing: border-box;
    width: 100%;
    color: var(--a-text-primary);
    font-family: var(--a-family-default);
    font-size: var(--a-type-base);
    font-weight: var(--a-weight-base);
    letter-spacing: var(--a-letter-base);
    line-height: var(--a-line-base);
  }

  &__row,
  &__item {
    @include apos-button-reset();
  }

  &__row:focus-within {
    box-shadow: inset 0 0 0 1px var(--a-base-7);
  }

  &__item {
    box-sizing: border-box;
    width: 100%;
    padding: $spacing-double $spacing-base + $spacing-half;
    outline: none;
  }

  &__info {
    margin: 10px 0 0;
  }

  &__published-times {
    margin-left: 0.2rem;
    color: var(--a-base-2);
  }

  &__action {
    margin-right: $spacing-base;
    margin-left: $spacing-base;
  }

  &__row {
    @include apos-transition(background-color);

    & {
      margin-left: 2px;
      border-bottom: 1px solid var(--a-base-8);
    }

    &:hover,
    &--active {
      background-color: var(--a-background-primary);
    }
  }
}
</style>
