<template>
  <button
    class="apos-table__cell-field" type="button"
    :class="`apos-table__cell-field--${header.name}`"
  >
    {{ item[header.name] }}
  </button>
</template>

<script>
export default {
  name: 'AposCellButton',
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
