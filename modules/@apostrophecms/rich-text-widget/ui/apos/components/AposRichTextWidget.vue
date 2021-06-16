<template>
  <div @click="clicked" v-html="rendered" />
</template>

<script>

import AposWidgetMixin from 'Modules/@apostrophecms/widget-type/mixins/AposWidgetMixin';

export default {
  name: 'AposRichTextWidget',
  mixins: [ AposWidgetMixin ],
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
