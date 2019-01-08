<template>
  <div @click="clicked" v-html="rendered"></div>
</template>

<script>

export default {
  mixins: [ apos.mixins.ApostropheWidget ],
  name: 'ApostropheRichTextWidget',
  methods: {
    clicked(e) {
      const link = apos.lean.closest(e.target, 'a');
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