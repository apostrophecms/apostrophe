<template>
  <div class="apos-loading">
    <!-- Disabling since the SVG is mostly not active vue template code. -->
    <!-- eslint-disable vue/max-attributes-per-line -->
    <svg viewBox="0 0 70 20">
      <defs>
        <linearGradient
          id="gradOne"
          x1="-0.858289931%" y1="100%" x2="100.756836%" y2="0%" spreadMethod="pad"
        >
          <stop offset="0%" stop-color="var(--a-brand-gold)" stop-opacity="1" />
          <stop offset="100%" stop-color="var(--a-brand-red)" stop-opacity="1" />
        </linearGradient>
        <linearGradient
          id="gradTwo"
          x1="-0.858289931%" y1="100%" x2="100.756836%" y2="0%" spreadMethod="pad"
        >
          <stop offset="0%" stop-color="var(--a-brand-red)" stop-opacity="1" />
          <stop offset="100%" stop-color="var(--a-brand-magenta)" stop-opacity="1" />
        </linearGradient>
        <linearGradient
          id="gradThree"
          x1="-0.858289931%" y1="100%" x2="100.756836%" y2="0%" spreadMethod="pad"
        >
          <stop offset="0%" stop-color="var(--a-brand-magenta)" stop-opacity="1" />
          <stop offset="100%" stop-color="var(--a-brand-blue)" stop-opacity="1" />
        </linearGradient>
      </defs>
      <g>
        <circle class="apos-loading__first" cx="10" cy="10" stroke-width="0" fill="url('#gradOne')" r="4.08836">
          <animate
            attributeName="r" dur="950ms" values="3;3;4;5;6;5;4;3" repeatCount="indefinite"
            keyTimes="0; 0.15; 0.3; 0.45; 0.6; 0.75; 0.9; 1"
            keySplines=".42 0 1 1; 0 0 .59 1; .42 0 1 1; 0 0 .59 1; .42 0 1 1; 0 0 .59 1; .42 0 1 1; 0 0 .59 1;"
          />
        </circle>
        <circle class="apos-loading__second" cx="30" cy="10" stroke-width="0" fill="url('#gradTwo')" r="5.08836">
          <animate
            attributeName="r" dur="950ms" values="4;3;3;4;5;6;5;4" repeatCount="indefinite"
            keyTimes="0; 0.15; 0.3; 0.45; 0.6; 0.75; 0.9; 1"
            keySplines=".42 0 1 1; 0 0 .59 1; .42 0 1 1; 0 0 .59 1; .42 0 1 1; 0 0 .59 1; .42 0 1 1; 0 0 .59 1;"
          />
        </circle>
        <circle class="apos-loading__third" cx="50" cy="10" stroke-width="0" fill="url('#gradThree')" r="5.91164">
          <animate
            attributeName="r" dur="950ms" values="5;4;3;3;4;5;6;5" repeatCount="indefinite"
            keyTimes="0; 0.15; 0.3; 0.45; 0.6; 0.75; 0.9; 1"
            keySplines=".42 0 1 1; 0 0 .59 1; .42 0 1 1; 0 0 .59 1; .42 0 1 1; 0 0 .59 1; .42 0 1 1; 0 0 .59 1;"
          />
        </circle>
      </g>
    </svg>
    <!-- eslint-enable vue/max-attributes-per-line -->
  </div>
</template>

<script>
module.exports = {
  name: 'AposLoading'
};
</script>

<style lang="scss" scoped>
  .apos-loading {
    max-width: 90px;
  }
</style>
