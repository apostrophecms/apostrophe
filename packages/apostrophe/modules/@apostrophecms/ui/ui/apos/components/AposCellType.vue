<template>
  <p
    class="apos-table__cell-field"
    :class="`apos-table__cell-field--${header.name}`"
  >
    {{ $t(label(get(header.name))) }}
  </p>
</template>

<script>
import AposCellMixin from 'Modules/@apostrophecms/ui/mixins/AposCellMixin';

export default {
  name: 'AposCellType',
  mixins: [ AposCellMixin ],
  methods: {
    label(typeName) {
      return (apos.modules[typeName] && apos.modules[typeName].label) || typeName;
    }
  }
};
</script>
