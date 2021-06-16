<template>
  <button
    @click="click" class="apos-area-menu__button"
    :data-action="item.name"
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
  emits: [ 'click', 'up', 'down' ],
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
  .apos-area-menu__item-icon {
    @include apos-align-icon();
    margin-right: 10px;
  }
</style>
