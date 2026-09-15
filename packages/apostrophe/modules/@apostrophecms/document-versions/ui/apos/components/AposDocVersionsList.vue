<template>
  <ul
    class="apos-doc-version-list"
  >
    <li
      v-for="version in versions"
      :key="version._id"
      class="apos-doc-version-list__row"
      data-apos-test="doc-version-item"
      :class="{ 'apos-doc-version-list__row--active' : hasActiveClass(version) }"
      @mouseover="activate(version)"
      @mouseleave="deactivate"
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

<script>
import locale from '../utils/locale.js';

const dateTimeFormat = locale.getDateTimeFormat();

export default {
  name: 'AposDocVersionsList',
  props: {
    currentVersion: {
      type: Object,
      default: null
    },
    versions: {
      type: Array,
      required: true
    }
  },
  emits: [ 'select' ],
  data() {
    return {
      activeId: null
    };
  },
  computed: {
    selectedVersion() {
      return this.currentVersion || {};
    },
    selectedId() {
      return this.selectedVersion._id;
    }
  },
  methods: {
    activate(version) {
      this.activeId = version._id;
    },
    deactivate() {
      this.activeId = null;
    },
    isSelected(version) {
      return this.selectedId === version._id;
    },
    isActive(version) {
      return this.activeId === version._id;
    },
    hasActiveClass(version) {
      return this.isActive(version) || this.isSelected(version);
    },
    toHumanDate(date) {
      return dateTimeFormat.format(new Date(date));
    },
    displayChangeCount(changeCount) {
      if (!changeCount) {
        return null;
      }

      return this.$t('apostrophe:publishedEdit', { count: changeCount });
    }
  }
};
</script>

<style lang="scss" scoped>

.apos-doc-version-list {
  @include apos-list-reset();

  & {
    display: block;
    box-sizing: border-box;
    width: 100%;
    // No matching color, the default (base-10) is #f4f4f4
    // background-color: #f3f3f3;
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
      // No matching color, using the default background (white)
      // background-color: #fcfcfc;
      background-color: var(--a-background-primary);
    }
  }
}
</style>
