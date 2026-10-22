<template>
  <button>Toolbar item has no definition: {{ name }}</button>
</template>

<script>

export default {
  name: 'AposTiptapUndefined',
  props: {
    name: {
      type: String,
      required: true
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-active {
  background-color: var(--a-danger);
}
</style>
