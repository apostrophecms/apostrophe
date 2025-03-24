<template>
  <div
    ref="container"
    class="apos-color__saturation"
    :style="{ background: bgColor }"
    @mousedown.prevent="handleMouseDown"
    @touchmove="handleChange"
    @touchstart="handleChange"
  >
    <div class="apos-color__saturation-white" />
    <div class="apos-color__saturation-black" />
    <div
      class="apos-color__saturation-pointer"
      :style="{ top: pointerTop, left: pointerLeft }"
    >
      <div class="apos-color__saturation-circle" />
    </div>
  </div>
</template>

<script>
export default {
  name: 'AposColorSaturation',
  props: {
    value: {
      type: Object,
      default: () => {
        return {};
      }
    }
  },
  emits: [ 'change' ],
  computed: {
    colors() {
      return this.value;
    },
    bgColor() {
      return `hsl(${this.colors.hsv.h}, 100%, 50%)`;
    },
    pointerTop() {
      return `${(-(this.colors.hsv.v * 100) + 1) + 100}%`;
    },
    pointerLeft() {
      return `${this.colors.hsv.s * 100}%`;
    }
  },
  methods: {
    handleChange(e, skip) {
      !skip && e.preventDefault();
      const { container } = this.$refs;
      if (!container) {
        // for some edge cases, container may not exist. see #220
        return;
      }
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      const xOffset = container.getBoundingClientRect().left + window.pageXOffset;
      const yOffset = container.getBoundingClientRect().top + window.pageYOffset;
      const pageX = e.pageX || (e.touches ? e.touches[0].pageX : 0);
      const pageY = e.pageY || (e.touches ? e.touches[0].pageY : 0);
      const left = this.clamp(pageX - xOffset, 0, containerWidth);
      const top = this.clamp(pageY - yOffset, 0, containerHeight);
      const saturation = left / containerWidth;
      const bright = this.clamp(-(top / containerHeight) + 1, 0, 1);

      this.onChange({
        h: this.colors.hsv.h,
        s: saturation,
        v: bright,
        a: this.colors.hsv.a,
        source: 'hsva'
      });
    },
    onChange(param) {
      this.$emit('change', param);
    },
    handleMouseDown(e) {
      window.addEventListener('mousemove', this.handleChange);
      window.addEventListener('mouseup', this.handleChange);
      window.addEventListener('mouseup', this.handleMouseUp);
    },
    handleMouseUp(e) {
      this.unbindEventListeners();
    },
    unbindEventListeners() {
      window.removeEventListener('mousemove', this.handleChange);
      window.removeEventListener('mouseup', this.handleChange);
      window.removeEventListener('mouseup', this.handleMouseUp);
    },
    clamp(value, min, max) {
      return min < max
        ? (value < min ? min : value > max ? max : value)
        : (value < max ? max : value > min ? min : value);
    }
  }
};
</script>

<style>
.apos-color__saturation,
.apos-color__saturation-white,
.apos-color__saturation-black {
  position: absolute;
  inset: 0;
  cursor: pointer;
}

.apos-color__saturation-white {
  background: linear-gradient(to right, #fff, rgb(255 255 255 / 0%));
}

.apos-color__saturation-black {
  background: linear-gradient(to top, #000, rgb(0 0 0 / 0%));
}

.apos-color__saturation-pointer {
  cursor: pointer;
  position: absolute;
}

.apos-color__saturation-circle {
  cursor: head;
  width: 4px;
  height: 4px;
  box-shadow: 0 0 0 1.5px #fff, inset 0 0 1px 1px rgb(0 0 0 / 30%), 0 0 1px 2px rgb(0 0 0 / 40%);
  border-radius: 50%;
  transform: translate(-2px, -2px);
}
</style>
