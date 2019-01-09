<template>
  <div @click="clicked" v-html="rendered"></div>
</template>

<script>

import ApostropheWidgetMixin from 'apostrophe/apostrophe-widgets/mixins/ApostropheWidgetMixin';

export default {
  name: 'ApostropheWidget',
  mixins: [ ApostropheWidgetMixin ]
}

</script>