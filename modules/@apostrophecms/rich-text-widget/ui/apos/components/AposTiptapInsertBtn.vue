<template>
  <button
    class="apos-rich-text-insert-menu-item"
    role="option"
    data-insert-menu-item
  >
    <div class="apos-rich-text-insert-menu-icon">
      <AposIndicator
        :icon="props.menuItem.icon"
        :icon-size="24"
        class="apos-button__icon"
        fill-color="currentColor"
      />
    </div>
    <div class="apos-rich-text-insert-menu-label">
      <h4 class="apos-rich-text-insert-menu-label__title">
        {{ $t(props.menuItem.label) }}
      </h4>
      <p class="apos-rich-text-insert-menu-label__desc">
        {{ $t(props.menuItem.description) }}
      </p>
    </div>
  </button>
</template>

<script setup>
const props = defineProps({
  name: {
    type: String,
    required: true
  },
  menuItem: {
    type: Object,
    required: true
  }
});

</script>

<style lang="scss">
  .apos-rich-text-insert-menu-item {
    @include apos-transition();

    & {
      all: unset;
      display: flex;
      box-sizing: border-box;
      flex-direction: row;
      align-items: center;
      width: 100%;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--a-base-9);
    }

    &:last-of-type {
      border-bottom: none;
    }

    &:hover {
      background-color: var(--a-primary-transparent-10);
    }

    &:active, &:focus {
      background-color: var(--a-primary);

      .apos-rich-text-insert-menu-label__title,
      .apos-rich-text-insert-menu-label__desc {
        color: var(--a-white);
      }
    }
  }

  .apos-rich-text-insert-menu-icon {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: 1px solid var(--a-base-8);
    color: var(--a-text-primary);
    background-color: var(--a-white);
    border-radius: var(--a-border-radius);
  }
</style>
