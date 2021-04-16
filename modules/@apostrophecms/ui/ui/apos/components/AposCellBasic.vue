<template>
  <p
    class="apos-table__cell-field"
    :class="`apos-table__cell-field--${header.name}`"
  >
    {{ item[header.name] }}
  </p>
</template>

<script>
export default {
  name: 'AposCellBasic',
  props: {
    item: {
      type: Object,
      required: true
    },
    header: {
      type: Object,
      required: true
    }
  }
};
</script>
