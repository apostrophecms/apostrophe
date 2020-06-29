<template>
  <div class="apos-spinner">
    <!-- Disabling since the SVG is mostly not active vue template code. -->
    <!-- eslint-disable vue/max-attributes-per-line -->
    <svg
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
          <circle fill="#fff" cx="36" cy="18" r="1" transform="rotate(266.312 18 18)">
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
    }
  },
  computed: {
    style () {
      if (this.color) {
        return `color: var(${this.color});`;
      }

      return 'color: var(--a-primary);';
    }
  }
};
</script>

<style lang="scss">
.apos-spinner {
  position: relative;
  width: 17px;
  height: 17px;
}
.apos-spinner__svg {
  max-width: 100%;
  max-height: 100%;
}
</style>
