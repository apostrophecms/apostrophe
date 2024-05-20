<template>
  <div class="apos-toggle__container">
    <div
      class="apos-toggle__slider"
      :class="{'apos-toggle__slider--activated': !modelValue}"
      @click="$emit('toggle')"
    />
  </div>
</template>

<script>

export default {
  props: {
    modelValue: {
      type: Boolean,
      required: true
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

      &::before {
        content: '';
        position: absolute;
        width: $btn-size;
        height: $btn-size;
        border-radius: 50%;
        background-color: var(--a-white);
        transition: all 0.3 ease-out;
      }
    }

    &__slider--activated {
      background-color: var(--a-primary);

      &::before {
        transform: translateX(calc($toggle-width - $btn-size));
      }
    }
  }
</style>
