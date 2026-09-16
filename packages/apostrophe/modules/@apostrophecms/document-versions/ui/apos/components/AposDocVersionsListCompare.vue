<template>
  <AposContextMenu
    v-if="versions?.length"
    :button="{
      label: toHumanDate(currentVersion?.createdAt),
      icon: 'chevron-down-icon',
      modifiers: [ 'quiet', 'no-motion' ]
    }"
    :unpadded="true"
    menu-placement="bottom-end"
    @open="openCompareMenu"
    @close="closeCompareMenu"
  >
    <template #prebutton>
      {{ $t('apostrophe:compare') }}
    </template>
    <dl
      ref="compareVersionMenu"
      class="apos-doc-version__compare-version-menu"
      role="menu"
      aria-label="menu"
    >
      <dt
        v-for="version in versions"
        :key="version.createdAt"
        class="apos-doc-version__compare-version-menu__item"
      >
        <button
          class="apos-doc-version__compare-version-menu__item__button"
          data-apos-test="doc-version-compare-version-select"
          :value="version._id"
          @click="$emit('select', version)"
        >
          {{ toHumanDate(version.createdAt) }}
        </button>
      </dt>
      <div
        ref="docVersionsSentinelCompare"
        class="apos-doc-version-sentinel--compare"
      />
    </dl>
  </AposContextMenu>
</template>

<script>
import observer from '../utils/observer.js';
import locale from '../utils/locale.js';

const dateTimeFormat = locale.getDateTimeFormat();

export default {
  name: 'AposDocVersionsListCompare',
  props: {
    currentVersion: {
      type: Object,
      default: () => ({})
    },
    versions: {
      type: Array,
      required: true
    },
    pager: {
      type: Object,
      default: () => ({})
    }
  },
  emits: [ 'select', 'load-more' ],
  data() {
    return {
      observer: null
    };
  },
  watch: {
    pager: {
      async handler(newVal, oldVal) {
        if (
          !this.observer || (
            newVal.currentPage === oldVal.currentPage &&
            newVal.pages === oldVal.pages
          )
        ) {
          return;
        }

        this.observer.updatePager(this.pager);
      }
    }
  },
  unmounted() {
    if (this.observer) {
      this.observer.disconnect();
    }
  },
  methods: {
    openCompareMenu() {
      if (!this.observer) {
        this.observer = observer({
          callback: this.loadMore,
          root: this.$refs.compareVersionMenu,
          rootMargin: '0px 0px 150px 0px',
          target: this.$refs.docVersionsSentinelCompare,
          pager: this.pager
        });
      }

      this.observer.observe();
    },
    closeCompareMenu() {
      this.observer.unobserve();
    },
    loadMore([ target ]) {
      if (!target.isIntersecting) {
        return;
      }
      this.$emit('load-more', [ target ]);
    },
    toHumanDate(date) {
      return dateTimeFormat.format(new Date(date));
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-doc-version-sentinel--compare {
  height: 2px;
}

.apos-doc-version__compare-version-menu {
  max-height: 160px;
  overflow-y: scroll;
}

.apos-doc-version__compare-version-menu__item {
  display: flex;
  flex-basis: 1;

  &__button {
    @include apos-button-reset();

    & {
      display: flex;
      gap: 20px;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      width: 100%;
      padding: 10px 20px;
    }
  }

  &__button:focus {
    outline: none;
    box-shadow: inset 0 0 0 1px var(--a-base-7);
  }

  &__label {
    @include type-large;

    & {
      flex-grow: 1;
      max-width: 370px;
      line-height: var(--a-line-tallest);
      margin: 0;
    }
  }

  &--disabled {
    pointer-events: none;
  }

  &--disabled &__label {
    color: $input-color-disabled;
  }
}
</style>
