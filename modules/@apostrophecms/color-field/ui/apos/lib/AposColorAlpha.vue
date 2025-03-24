<template>
  <div class="apos-color__alpha">
    <div class="apos-color__alpha-checkboard-wrap">
      <AposColorCheckerboard />
    </div>
    <div
      class="apos-color__alpha-gradient"
      :style="{ background: gradientColor }"
    />
    <div
      ref="container"
      class="apos-color__alpha-container"
      @mousedown.prevent="handleMouseDown"
      @touchmove="handleChange"
      @touchstart="handleChange"
    >
      <div
        class="apos-color__alpha-pointer"
        :style="{ left: `${colors.a * 100}%` }"
      >
        <div class="apos-color__alpha-picker" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AposColorAlpha',
  props: {
    value: {
      type: Object,
      default: () => {
        return {};
      }
    },
    onChange: {
      type: Function,
      default: () => {}
    }
  },
  emits: [ 'change' ],
  computed: {
    colors() {
      return this.value;
    },
    gradientColor() {
      const { rgba } = this.colors;
      const rgbStr = [ rgba.r, rgba.g, rgba.b ].join(',');
      return `linear-gradient(to right, rgba(${rgbStr}, 0) 0%, rgba(${rgbStr}, 1) 100%)`;
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

      const xOffset = container.getBoundingClientRect().left + window.pageXOffset;
      const pageX = e.pageX || (e.touches ? e.touches[0].pageX : 0);
      const left = pageX - xOffset;

      let a;
      if (left < 0) {
        a = 0;
      } else if (left > containerWidth) {
        a = 1;
      } else {
        a = Math.round(left * 100 / containerWidth) / 100;
      }

      if (this.colors.a !== a) {
        this.$emit('change', {
          h: this.colors.hsl.h,
          s: this.colors.hsl.s,
          l: this.colors.hsl.l,
          a,
          source: 'rgba'
        });
      }
    },
    handleMouseDown(e) {
      this.handleChange(e, true);
      window.addEventListener('mousemove', this.handleChange);
      window.addEventListener('mouseup', this.handleMouseUp);
    },
    handleMouseUp() {
      this.unbindEventListeners();
    },
    unbindEventListeners() {
      window.removeEventListener('mousemove', this.handleChange);
      window.removeEventListener('mouseup', this.handleMouseUp);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-color__alpha {
  position: absolute;
  inset: 0;
}

.apos-color__alpha-checkboard-wrap {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.apos-color__alpha-gradient {
  position: absolute;
  inset: 0;
}

.apos-color__alpha-container {
  z-index: $z-index-default;
  position: relative;
  height: 100%;
  margin: 0 3px;
  cursor: pointer;
}

.apos-color__alpha-pointer {
  z-index: $z-index-default;
  position: absolute;
}

.apos-color__alpha-picker {
  width: 4px;
  height: 8px;
  margin-top: 1px;
  background: #fff;
  cursor: pointer;
  border-radius: 1px;
  box-shadow: 0 0 2px rgb(0 0 0 / 60%);
  transform: translateX(-2px);
}
</style>
