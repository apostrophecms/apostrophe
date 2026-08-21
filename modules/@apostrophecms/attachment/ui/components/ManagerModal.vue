<template>
  <slot />
</template>

<script>
export default {
  name: 'ApostropheAttachmentManagerModalOverride',
  methods: {
    openImageEditor(image) {
      const id = (image && image._id) ? image._id : image;
      this.$emit('open-editor', 'apostrophe-attachment', id);
    }
  }
};
</script>

<style scoped></style>
