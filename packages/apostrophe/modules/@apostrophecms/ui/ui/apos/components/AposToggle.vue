<template>
  <div class="apos-toggle__container">
    <div
      class="apos-toggle__slider"
      :tabindex="disableFocus ? null : '0'"
      :class="{'apos-toggle__slider--activated': !modelValue}"
      @click="$emit('toggle')"
      @keydown.stop.space="$emit('toggle')"
      @keydown.stop.enter="$emit('toggle')"
    />
  </div>
</template>

<script>

export default {
  props: {
    modelValue: {
      type: Boolean,
      required: true
    },
    disableFocus: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'toggle' ],
  data () {
    return {
      activated: false
    };
  },
  methods: {
    toggle() {
      this.activated = !this.activated;
    }
  }
};
</script>
<style scoped lang='scss'>
  $toggle-height: 13px;
  $toggle-width: $toggle-height * 1.7;
  $btn-size: $toggle-height;

  .apos-toggle {
    &__slider {
      position: relative;
      box-sizing: content-box;
      width: $toggle-width;
      height: $toggle-height;
      padding: 4px;
      border-radius: 34px;
      cursor: pointer;
      background-color: var(--a-base-3);

      &:focus,
      &:hover,
      &:active {
        box-shadow: 0 0 10px var(--a-base-1);
        outline: 2px solid var(--a-primary-transparent-90);
      }

      &::before {
        content: '';
        position: absolute;
        width: $btn-size;
        height: $btn-size;
        border-radius: 50%;
        background-color: var(--a-white);
        transition: all 300ms ease-out;
      }
    }

    &__slider--activated {
      background-color: var(--a-primary);

      &:focus,
      &:hover,
      &:active {
        outline: 2px solid var(--a-primary-transparent-25);
      }

      &::before {
        transform: translateX(calc($toggle-width - $btn-size));
      }
    }
  }
</style>
