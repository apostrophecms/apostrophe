<template>
  <div @click="clicked" v-html="rendered"></div>
</template>

<script>

import ApostropheWidgetMixin from 'apostrophe/apostrophe-widget-type/mixins/ApostropheWidgetMixin';

export default {
  mixins: [ ApostropheWidgetMixin ],
  name: 'ApostropheRichTextWidget',
  methods: {
    clicked(e) {
      const link = apos.utils.closest(e.target, 'a');
      if (link) {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      this.$emit('edit');
    }
  }
}

</script>