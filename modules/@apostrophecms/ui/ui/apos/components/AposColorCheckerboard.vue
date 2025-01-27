<template>
  <div class="apos-color__checkerboard" />
</template>

<script>
export default {
  name: 'AposColorCheckerboard'
};
</script>

<style>
.apos-color__checkerboard {
  background-image: repeating-conic-gradient(#d3d3d3 0% 25%, #fff 0% 50%);
  background-size: 8px 8px;
  height: 100%;
}
</style>
