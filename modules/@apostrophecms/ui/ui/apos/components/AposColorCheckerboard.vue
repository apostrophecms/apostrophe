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
  background-image: repeating-conic-gradient(
    var(--a-checker-board-gray) 0% 25%,
    var(--a-checker-board-white) 0% 50%
  );
  background-size: 8px 8px;
  height: 100%;
}
</style>
