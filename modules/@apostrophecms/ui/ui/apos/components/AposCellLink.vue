<template>
  <a
    :href="displayValue(header.name)"
    @click.stop
  >
    <link-icon :size="14" />
  </a>
</template>

<script>

import AposCellMixin from 'Modules/@apostrophecms/ui/mixins/AposCellMixin';

export default {
  name: 'AposCellLink',
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
