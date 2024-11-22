<template>
  <div class="apos-color__hue" :class="[directionClass]">
    <div
      ref="container"
      class="vc-hue-container"
      role="slider"
      :aria-valuenow="colors.hsl.h"
      aria-valuemin="0"
      aria-valuemax="360"
      @mousedown="handleMouseDown"
      @touchmove="handleChange"
      @touchstart="handleChange"
    >
      <div
        class="apos-color__hue-pointer"
        :style="{ top: pointerTop, left: pointerLeft }"
        role="presentation"
      >
        <div class="apos-color__hue-picker" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AposColorHue',
  props: {
    value: {
      type: Object,
      default: () => {
        return {};
      }
    },
    direction: {
      type: String,
      default: 'horizontal',
      validator(value) {
        return [ 'horizontal', 'vertical' ].includes(value);
      }
    }
  },
  emits: [ 'change' ],
  data() {
    return {
      oldHue: 0,
      pullDirection: ''
    };
  },
  computed: {
    colors() {
      return this.value;
    },
    directionClass() {
      return {
        'apos-color__hue--horizontal': this.direction === 'horizontal',
        'apos-color__hue--vertical': this.direction === 'vertical'
      };
    },
    pointerTop() {
      if (this.direction === 'vertical') {
        if (this.colors.hsl.h === 0 && this.pullDirection === 'right') {
          return 0;
        }
        return `${-((this.colors.hsl.h * 100) / 360) + 100}%`;
      }
      return 0;
    },
    pointerLeft() {
      if (this.direction === 'vertical') {
        return 0;
      }

      if (this.colors.hsl.h === 0 && this.pullDirection === 'right') {
        return '100%';
      }
      return `${(this.colors.hsl.h * 100) / 360}%`;
    }
  },
  watch: {
    value: {
      handler(value) {
        const { h } = value.hsl;
        if (h !== 0 && h - this.oldHue > 0) {
          this.pullDirection = 'right';
        }
        if (h !== 0 && h - this.oldHue < 0) {
          this.pullDirection = 'left';
        }
        this.oldHue = h;
      },
      deep: true,
      immediate: true
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
      const left = pageX - xOffset;
      const top = pageY - yOffset;

      let h;
      let percent;

      if (this.direction === 'vertical') {
        if (top < 0) {
          h = 360;
        } else if (top > containerHeight) {
          h = 0;
        } else {
          percent = -(top * 100 / containerHeight) + 100;
          h = (360 * percent / 100);
        }

        if (this.colors.hsl.h !== h) {
          this.$emit('change', {
            h,
            s: this.colors.hsl.s,
            l: this.colors.hsl.l,
            a: this.colors.hsl.a,
            source: 'hsl'
          });
        }
      } else {
        if (left < 0) {
          h = 0;
        } else if (left > containerWidth) {
          h = 360;
        } else {
          percent = left * 100 / containerWidth;
          h = (360 * percent / 100);
        }

        if (this.colors.hsl.h !== h) {
          this.$emit('change', {
            h,
            s: this.colors.hsl.s,
            l: this.colors.hsl.l,
            a: this.colors.hsl.a,
            source: 'hsl'
          });
        }
      }
    },
    handleMouseDown(e) {
      this.handleChange(e, true);
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
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-color__hue {
  position: absolute;
  inset: 0;
  border-radius: 2px;
}

.apos-color__hue--horizontal {
  background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
}

.apos-color__hue--vertical {
  background: linear-gradient(to top, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
}

.apos-color__hue-container {
  position: relative;
  height: 100%;
  margin: 0 2px;
  cursor: pointer;
}

.apos-color__hue-pointer {
  z-index: $z-index-default;
  position: absolute;
}

.apos-color__hue-picker {
  width: 4px;
  height: 8px;
  margin-top: 1px;
  background: #fff;
  cursor: pointer;
  border-radius: 1px;
  box-shadow: 0 0 2px rgb(0 0 0 / 60%);
  transform: translateX(-2px) ;
}
</style>
