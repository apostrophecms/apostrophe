<template>
  <div @click="clicked" v-html="rendered"></div>
</template>

<script>

import ApostropheWidgetMixin from 'apostrophe/@apostrophecms/widget-type/mixins/ApostropheWidgetMixin';

export default {
  name: 'ApostropheWidget',
  mixins: [ ApostropheWidgetMixin ]
}

</script>