<template>
  <p
    class="apos-table__cell-field"
    :class="`apos-table__cell-field--${header.name}`"
  >
    {{ label(get(header.name)) }}
  </p>
</template>

<script>
import AposCellMixin from 'Modules/@apostrophecms/ui/mixins/AposCellMixin';

export default {
  name: 'AposCellType',
  mixins: [ AposCellMixin ],
  methods: {
    label(typeName) {
      return this.$t((apos.modules[typeName] && apos.modules[typeName].label) || typeName);
    }
  }
};
</script>
