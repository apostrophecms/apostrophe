<template>
  <button
    @click="click" class="apos-area-menu__button"
    :data-action="item.action"
    :tabindex="String(tabindex)"
    @keydown.prevent.arrow-down="$emit('down')"
    @keydown.prevent.arrow-up="$emit('up')"
  >
    <component
      v-if="item.icon"
      :size="15"
      class="apos-area-menu__item-icon"
      :is="item.icon"
    />
    {{ item.label }}
  </button>
</template>

<script>

export default {
  props: {
    item: {
      required: true,
      type: Object
    },
    tabbable: {
      type: Boolean,
      default: true
    }
  },
  emits: ['click', 'up', 'down'],
  computed: {
    tabindex() {
      if (this.tabbable) {
        return 0;
      } else {
        return -1;
      }
    }
  },
  methods: {
    click() {
      this.$emit('click');
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-tag-list__button {
  @include apos-button-reset();
  display: flex;
  align-items: center;
  padding: 7.5px 10px;
  border-radius: 5px;
  background: transparent;
  @include apos-transition(all, 0.1s, ease-in-out);
  &.is-active {
    background-color: var(--a-primary);
    color: var(--a-white);
  }
  &:hover,
  &:focus {
    background-color: var(--a-base-8);
    .apos-tag-list__icon--tag {
      color: var(--a-base-2);
    }
  }
  &:hover.is-active,
  &:focus.is-active {
    background-color: var(--a-primary-button-hover);
    color: var(--a-white);
  }
  &:focus {
    outline: none;
    box-shadow: 0 0 5px var(--a-base-6);
  }
  &:focus.is-active {
    box-shadow: 0 0 5px var(--a-primary-button-active);
  }
}

.apos-area-menu__item-icon {
  @include apos-align-icon();
  margin-right: 10px;
}

</style>
