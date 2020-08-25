
<template>
  <transition name="fade">
    <li
      class="apos-slat"
      :data-id="item.id"
      tabindex="0"
      :class="{'is-engaged': engaged}"
      @keydown.prevent.space="toggleEngage"
      @keydown.prevent.enter="toggleEngage"
      @keydown.prevent.escape="disengage"
      @keydown.prevent.arrow-down="move(1)"
      @keydown.prevent.arrow-up="move(-1)"
      @keydown.prevent.backspace="remove(true)"
      :aria-pressed="engaged"
      role="listitem"
      :aria-labelledby="parent"
    >
      <div class="apos-slat__main">
        <drag-icon class="apos-slat__control apos-slat__control--drag" :size="13" />
        <div class="apos-slat__label">
          {{ item.label }}
        </div>
      </div>
      <div class="apos-slat__secondary">
        <close-icon
          @click="remove" class="apos-slat__control apos-slat__control--remove"
          :size="13"
        />
      </div>
    </li>
  </transition>
</template>

<script>
// TODO: Add Storybook story with demo API.

export default {
  name: 'AposSlat',
  props: {
    item: {
      type: Object,
      required: true
    },
    parent: {
      type: String,
      required: true
    },
    engaged: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'engage', 'disengage', 'move', 'remove' ],
  data() {
    return {
    };
  },
  methods: {
    toggleEngage() {
      if (this.engaged) {
        this.disengage();
      } else {
        this.engage();
      }
    },
    engage() {
      this.$emit('engage', this.item.id);
    },
    disengage() {
      this.$emit('disengage', this.item.id);
    },
    move(dir) {
      if (this.engaged) {
        if (dir > 0) {
          this.$emit('move', this.item.id, 1);
        } else {
          this.$emit('move', this.item.id, -1);
        }
      }
    },
    remove(focusNext) {
      this.$emit('remove', this.item, focusNext);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-slat {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px;
    border: 1px solid var(--a-base-5);
    border-radius: var(--a-border-radius);
    background-color: var(--a-base-9);
    color: var(--a-text-primary);
    @include apos-transition();
    &:hover:not(.apos-slat-list__item--disabled) {
      background-color: var(--a-base-7);
      cursor: grab;
    }
    &:active:not(.apos-slat-list__item--disabled) {
      cursor: grabbing;
    }
    &:active:not(.apos-slat-list__item--disabled),
    &:focus:not(.apos-slat-list__item--disabled) {
      background-color: var(--a-base-7);
    }
  }

  .apos-slat.is-engaged,
  .apos-slat.is-engaged:focus {
    background-color: var(--a-primary);
    color: var(--a-white);
  }

  .apos-slat-list__item--disabled {
    opacity: 0.5;
    &:hover {
      cursor: not-allowed;
    }
  }

  .apos-slat__main {
    display: flex;
  }

  .apos-slat__label {
    font-size: map-get($font-sizes, meta);
    margin-left: 10px;
  }

  .apos-slat__control {
    display: flex;
    align-content: center;
    margin-right: 5px;
  }

  .apos-slat__control--remove:hover {
    cursor: pointer;
  }

  .fade-enter-active, .fade-leave-active {
    transition: opacity 0.5s;
  }
  .fade-enter, .fade-leave-to {
    opacity: 0;
  }
</style>
