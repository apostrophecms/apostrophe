<template>
  <div class="apos-spinner" :class="className">
    <!-- Disabling since the SVG is mostly not active vue template code. -->
    <!-- eslint-disable vue/max-attributes-per-line -->
    <svg
      v-if="weight === 'heavy'"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 23 23"
      class="apos-spinner__svg apos-spinner__svg--heavy"
      :style="style"
    >
      <defs>
        <linearGradient id="linear-gradient" x1="-280.32" y1="390.11" x2="-279.82" y2="390.9" gradientTransform="matrix(22.2, 0, 0, -22.2, 6233.2, 8673.92)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#cca9ff"/>
          <stop offset="1" stop-color="#6516dd"/>
        </linearGradient>
        <linearGradient id="linear-gradient-2" x1="-276.41" y1="379.82" x2="-276.72" y2="379.33" gradientTransform="matrix(17.69, 0, 0, -13.7, 4908.02, 5205.92)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#c8a2ff"/>
          <stop offset="1" stop-color="#6516dd"/>
        </linearGradient>
      </defs>
      <path class="apos-spinner__svg-track" d="M11.5.32a11.1,11.1,0,1,0,11.1,11.1A11.1,11.1,0,0,0,11.5.32Zm0,5.2a5.9,5.9,0,1,1-5.9,5.9A5.9,5.9,0,0,1,11.5,5.52Z" fill="url(#linear-gradient)"/>
      <path class="apos-spinner__svg-spinner" d="M11.5.32a11.1,11.1,0,0,1,11.1,11.1,2.6,2.6,0,0,1-5.19.17v-.17a5.9,5.9,0,0,0-5.9-5.9A5.83,5.83,0,0,0,9,6.07l-.29.14A2.6,2.6,0,1,1,6.29,1.62,11,11,0,0,1,11.5.32Z" fill="url(#linear-gradient-2)"/>
    </svg>
    <svg
      v-else
      xmlns="http://www.w3.org/2000/svg"
      class="apos-spinner__svg"
      width="38"
      height="38"
      viewBox="0 0 38 38"
      :style="style"
    >
      <defs>
        <linearGradient x1="8.042%" y1="0%" x2="65.682%" y2="23.865%" id="a">
          <stop stop-color="currentColor" stop-opacity="0" offset="0%" />
          <stop stop-color="currentColor" stop-opacity=".631" offset="63.146%" />
          <stop stop-color="currentColor" offset="100%" />
        </linearGradient>
      </defs>
      <g fill="none" fill-rule="evenodd">
        <g transform="translate(1 1)">
          <path d="M36 18c0-9.94-8.06-18-18-18" id="Oval-2" stroke="url(#a)" stroke-width="2" transform="rotate(266.312 18 18)">
            <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="0.9s" repeatCount="indefinite" />
          </path>
          <circle fill="currentColor" cx="36" cy="18" r="1" transform="rotate(266.312 18 18)">
            <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="0.9s" repeatCount="indefinite" />
          </circle>
        </g>
      </g>
    </svg>
    <!-- eslint-enable vue/max-attributes-per-line -->
  </div>
</template>

<script>
module.exports = {
  name: 'AposSpinner',
  props: {
    color: {
      type: String,
      default: '--a-primary'
    },
    weight: {
      type: String,
      default: 'normal'
    }
  },
  computed: {
    style () {
      if (this.color) {
        return `color: var(${this.color});`;
      }

      return 'color: var(--a-primary);';
    },
    className() {
      return `apos-spinner--${this.weight}`
    }
  },
};
</script>

<style lang="scss" scoped>
.apos-spinner {
  position: relative;
  width: 17px;
  height: 17px;
  &--heavy {
    width: 27px;
    height: 27px;
  }
}
.apos-spinner__svg {
  max-width: 100%;
  max-height: 100%;
}

.apos-spinner__svg-track {
  animation: counterClockwise 2s infinite linear;
  transform-origin: 50% 50%;
  transform: scale(100, 100);
}

.apos-spinner__svg-spinner {
  animation: clockwise 1s infinite linear;
  transform-origin: 50% 50%;
  transform: scale(100, 100);
}

@keyframes clockwise {
  from {
    -webkit-transform: rotate(0deg);
  }
    to {
    -webkit-transform: rotate(359deg);
  }
}

@keyframes counterClockwise {
  from {
    -webkit-transform: rotate(0deg);
  }
    to {
    -webkit-transform: rotate(-359deg);
  }
}
</style>
