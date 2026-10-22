<template>
  <ul
    ref="list"
    class="apos-doc-version-list"
  >
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
        <AposDocVersionsEntry :version="version" />
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
import { computed, ref } from 'vue';

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

const list = ref(null);
const selectedId = computed(() => props.currentVersion?._id || null);

function focus(versionId) {
  list.value
    ?.querySelector(`button[value="${CSS.escape(versionId)}"]`)
    ?.focus();
}

defineExpose({ focus });
</script>

<style lang="scss" scoped>
// The width of the entry's avatar pair, so the actions line up with its copy
$avatars-width: 44px;
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
      box-sizing: border-box;
      width: 100%;
      padding: $spacing-base + $spacing-half $spacing-base + $spacing-half
        $spacing-base + $spacing-half $spacing-base;
      outline: none;
      text-align: left;
    }
  }

  &__row--active &__item {
    padding-bottom: $spacing-half;
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
