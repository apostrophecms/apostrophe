<template>
  <div @click="clicked" v-html="rendered" />
</template>

<script>

import ApostropheWidgetMixin from 'Modules/@apostrophecms/widget-type/mixins/ApostropheWidgetMixin';

export default {
  name: 'ApostropheRichTextWidget',
  mixins: [ ApostropheWidgetMixin ],
  emits: [ 'edit' ],
  methods: {
    clicked(e) {
      const link = apos.util.closest(e.target, 'a');
      if (link) {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      this.$emit('edit');
    }
  }
};

</script>
