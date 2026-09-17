<template>
  <AposContextMenu
    v-if="versions.length"
    :button="{
      label: toHumanDate(currentVersion?.createdAt),
      icon: 'chevron-down-icon',
      modifiers: [ 'quiet', 'no-motion' ]
    }"
    :unpadded="true"
    menu-placement="bottom-end"
    @open="onOpen"
    @close="stopScroll"
  >
    <template #prebutton>
      {{ $t('apostrophe:compare') }}
    </template>
    <dl
      ref="menu"
      class="apos-doc-version__compare-version-menu"
      role="menu"
      aria-label="menu"
    >
      <dt
        v-for="version in versions"
        :key="version._id"
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
        ref="sentinel"
        class="apos-doc-version-sentinel--compare"
      />
    </dl>
  </AposContextMenu>
</template>

<script setup>
import {
  nextTick, ref, watch
} from 'vue';
import { useInfiniteScroll } from 'Modules/@apostrophecms/ui/composables/useInfiniteScroll.js';
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

const emit = defineEmits([ 'select', 'load-more' ]);

const dateTimeFormat = locale.getDateTimeFormat();
const menu = ref(null);
const sentinel = ref(null);

const {
  start: startScroll,
  stop: stopScroll,
  recheck
} = useInfiniteScroll(sentinel, () => emit('load-more'), {
  rootMargin: '0px 0px 150px 0px',
  root: menu
});

async function onOpen() {
  await nextTick();
  startScroll();
}

watch(() => props.versions, () => {
  nextTick(recheck);
});

function toHumanDate(date) {
  return date ? dateTimeFormat.format(new Date(date)) : '';
}
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
