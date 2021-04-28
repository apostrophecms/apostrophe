<template>
  <p
    class="apos-table__cell-field"
    :class="`apos-table__cell-field--${header.name}`"
  >
    {{ label(displayValue(item.type)) }}
  </p>
</template>

<script>
import AposCellMixin from 'Modules/@apostrophecms/ui/mixins/AposCellMixin';

export default {
  name: 'AposCellType',
  mixins: [ AposCellMixin ],
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
