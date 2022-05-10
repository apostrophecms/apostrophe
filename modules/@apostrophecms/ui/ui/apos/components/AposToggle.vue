<template>
  <div class="apos-toggle__container">
    <div
      class="apos-toggle__slider"
      :class="{'apos-toggle__slider--activated': !value}"
      @click="$emit('toggle')"
    />
  </div>
</template>

<script>

export default {
  props: {
    value: {
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
  $toggleHeight: 13px;
  $toggleWidth: $toggleHeight * 1.7;
  $btnSize: $toggleHeight;

  .apos-toggle {
    &__slider {
      box-sizing: content-box;
      position: relative;
      border-radius: 34px;
      width: $toggleWidth;
      height: $toggleHeight;
      padding: 4px;
      cursor: pointer;
      background-color: var(--a-base-3);

      &:before {
        content: '';
        position: absolute;
        width: $btnSize;
        height: $btnSize;
        border-radius: 50%;
        background-color: var(--a-white);
        transition: all 0.3s ease-out;
      }
    }

    &__slider--activated {
      background-color: var(--a-primary);

      &:before {
        transform: translateX(calc($toggleWidth - $btnSize));
      }
    }
  }
</style>
