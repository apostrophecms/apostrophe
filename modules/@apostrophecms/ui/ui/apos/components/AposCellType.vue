<template>
  <p
    class="apos-table__cell-field"
    :class="`apos-table__cell-field--${header.name}`"
  >
    {{ label(item.type) }}
  </p>
</template>

<script>
export default {
  name: 'AposCellType',
  props: {
    item: {
      type: Object,
      required: true
    },
    header: {
      type: Object,
      required: true
    }
  },
  methods: {
    label(typeName) {
      return (apos.modules[typeName] && apos.modules[typeName].label) || typeName;
    }
  }
};
</script>
