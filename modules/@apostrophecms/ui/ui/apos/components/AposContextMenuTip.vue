<!-- eslint-disable max-len -->
<template>
  <svg
    :ref="(el) => emit('set-arrow', el)"
    class="apos-context-menu__tip"
    width="27px"
    height="11px"
    viewBox="0 0 27 11"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g
      width="27px"
      height="11px"
      stroke="none"
      stroke-width="1"
      fill="none"
      fill-rule="evenodd"
    >
      <path
        class="apos-context-menu__tip-outline"
        d="M17.2842712,1.46446609 L25.748,9.928 L1.749,9.928 L10.2132034,1.46446609 C12.1658249,-0.488155365 15.3316498,-0.488155365 17.2842712,1.46446609 Z"
        stroke="var(--a-base-8)"
      />
      <path
        class="apos-context-menu__tip-background"
        d="M17.0029602,1.84623992 C15.3903198,0.179595947 12.5749711,0.0148310371 10.7918701,1.61499023 C9.60313614,2.68176303 9.52086075,2.75884626 10.5450439,1.84623992 L0.815307617,11.4361572 L26.6676025,11.4361572 L17.0029602,1.84623992 Z"
        fill="var(--a-background-primary)"
        fill-rule="nonzero"
      />
    </g>
  </svg>
</template>

<script setup>
const emit = defineEmits([ 'set-arrow' ]);
</script>

<style lang="scss">
  .apos-context-menu__tip {
    position: absolute;
  }
</style>
