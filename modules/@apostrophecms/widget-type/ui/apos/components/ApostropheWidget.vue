<template>
  <div @click="clicked" v-html="rendered"></div>
</template>

<script>

import ApostropheWidgetMixin from 'Modules/@apostrophecms/widget-type/mixins/ApostropheWidgetMixin';

export default {
  name: 'ApostropheWidget',
  mixins: [ ApostropheWidgetMixin ]
}

</script>