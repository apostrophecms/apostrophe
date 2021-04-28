<template>
  <a
    :href="get(header.name)"
    @click.stop
  >
    <link-icon :size="14" />
  </a>
</template>

<script>

import AposCellMixin from 'Modules/@apostrophecms/ui/mixins/AposCellMixin';

export default {
  name: 'AposCellLink',
  mixins: [ AposCellMixin ]
};
</script>
