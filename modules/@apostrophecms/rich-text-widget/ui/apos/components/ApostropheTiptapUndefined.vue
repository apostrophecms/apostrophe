<template>
  <button>Toolbar item has no definition: {{ name }}</button>
</template>

<script>

export default {
  name: 'ApostropheTiptapUndefined',
  props: {
    name: String
  }
};
</script>

<style lang="scss" scoped>
.apos-active {
  background-color: var(--a-danger);
}
</style>
