<template>
  <div
    class="apos-modal__rail"
    :class="[
      `apos-modal__rail--${type}`,
      {
        'apos-modal__rail--collapsible': collapsible,
        'apos-modal__rail--collapsed': collapsed
      }
    ]"
  >
    <template v-if="collapsible">
      <button
        v-apos-tooltip="toggleLabel"
        type="button"
        class="apos-modal__rail-toggle"
        :aria-expanded="!collapsed"
        :aria-controls="contentId"
        :aria-label="$t(toggleLabel)"
        data-apos-test="modal-rail-toggle"
        @click="collapsed = !collapsed"
      >
        <component
          :is="collapsed ? 'chevron-right-icon' : 'chevron-left-icon'"
          :size="16"
        />
      </button>
      <div
        :id="contentId"
        class="apos-modal__rail-content"
        :inert="collapsed || undefined"
      >
        <slot />
      </div>
    </template>
    <slot v-else />
  </div>
</template>

<script setup>
import {
  computed, ref, useId
} from 'vue';

defineProps({
  type: {
    type: String,
    default: 'left'
  },
  // Adds a toggle that collapses the rail to a narrow strip. The modal
  // grid follows through the `apos-modal__rail--collapsed` class.
  collapsible: {
    type: Boolean,
    default: false
  }
});

const collapsed = ref(false);
const contentId = useId();
const toggleLabel = computed(() => {
  return collapsed.value ? 'apostrophe:expandTabs' : 'apostrophe:collapseTabs';
});
</script>

<style lang="scss" scoped>
  .apos-modal__rail {
    overflow-y: auto;
    background-color: var(--a-base-10);
  }

  .apos-modal__rail--collapsible {
    z-index: $z-index-default;
    position: relative;
    overflow: visible;
  }

  .apos-modal__rail-content {
    overflow-y: auto;
    height: 100%;
    transition: opacity 200ms cubic-bezier(0.23, 1, 0.32, 1);

    .apos-modal__rail--collapsed & {
      overflow: hidden;
      opacity: 0;
    }
  }

  .apos-modal__rail-toggle {
    @include apos-button-reset();

    & {
      z-index: $z-index-default;
      position: absolute;
      top: 18px;
      right: 0;
      display: inline-flex;
      box-sizing: border-box;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: 1px solid var(--a-base-7);
      border-radius: 50%;
      color: var(--a-base-2);
      background-color: var(--a-background-primary);
      box-shadow: 0 1px 2px rgb(0 0 0 / 8%);
      transform: translateX(50%);
      transition: background-color 200ms ease, color 200ms ease;
      cursor: pointer;
    }

    &:hover,
    &:focus-visible {
      color: var(--a-text-primary);
      background-color: var(--a-base-10);
    }

    &:focus-visible {
      outline: 2px solid var(--a-base-6);
      outline-offset: 1px;
    }
  }
</style>
