<template>
  <button
    class="apos-table__cell-field" type="button"
    :class="`apos-table__cell-field--${header.name}`"
  >
    {{ get(header.name) }}
  </button>
</template>

<script>
import AposCellMixin from 'Modules/@apostrophecms/ui/mixins/AposCellMixin';

export default {
  name: 'AposCellButton',
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
  }
};
</script>
