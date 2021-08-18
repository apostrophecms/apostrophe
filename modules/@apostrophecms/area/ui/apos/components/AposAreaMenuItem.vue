<template>
  <button
    @click="click" class="apos-area-menu__button"
    :class="{ 'apos-area-menu__button--separated': item.type }"
    :data-action="item.name"
    :tabindex="String(tabindex)"
    @keydown.prevent.arrow-down="$emit('down')"
    @keydown.prevent.arrow-up="$emit('up')"
  >
    <div
      v-if="item.type === 'clipboard'"
      class="apos-area-menu__item-sublabel"
    >
      Clipboard
    </div>
    <div class="apos-area-menu__item-content">
      <component
        v-if="item.icon"
        :size="15"
        class="apos-area-menu__item-icon"
        :is="item.icon"
      />
      {{ $t(item.label) }}
    </div>
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
  .apos-area-menu__button--separated {
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--a-base-9);
  }

  .apos-area-menu__item-icon {
    @include apos-align-icon();
    margin-right: 10px;
  }
  .apos-area-menu__item-content {
    display: flex;
    align-items: center;
  }
  .apos-area-menu__item-sublabel {
    margin-bottom: 10px;
    color: var(--a-base-4);
  }
</style>
