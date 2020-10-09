<template>
  <div @click="clicked" v-html="rendered" />
</template>

<script>

import AposWidgetMixin from 'Modules/@apostrophecms/widget-type/mixins/AposWidgetMixin';

export default {
  name: 'ApostropheWidget',
  mixins: [ AposWidgetMixin ]
};

</script>
