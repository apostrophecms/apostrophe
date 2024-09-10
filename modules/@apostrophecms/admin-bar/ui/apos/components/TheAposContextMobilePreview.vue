<template>
  <div
    data-apos-test="mobilePreview"
    class="apos-admin-bar"
  >
    <component
      :is="'AposButton'"
      v-for="screen in screens"
      :key="screen.id"
      :modifiers="['small', 'no-motion']"
      :label="screen.label"
      :icon="screen.icon"
      :icon-only="true"
      type="subtle"
      class="apos-admin-bar__context-button"
      @click="preview(screen.id, screen.width)"
    />
  </div>
</template>
<script>
export default {
  name: 'TheAposContextMobilePreview',
  emits: [ 'switch-preview-mode' ],
  computed: {
    screens() {
      // TODO: set from asset options
      // TODO: set toggle mode
      // TODO: set :data-apos-test="preview-${screen.id}"
      return [
        {
          id: 'desktop',
          label: 'apostrophe:previewDesktop',
          icon: 'monitor-icon',
          width: 1024
        },
        {
          id: 'tablet',
          label: 'apostrophe:previewTablet',
          icon: 'tablet-icon',
          width: 640
        },
        {
          id: 'phone',
          label: 'apostrophe:previewPhone',
          icon: 'cellphone-icon',
          width: 480
        }
      ];
    }
  },
  //mounted() {
  //  apos.bus.$on('command-menu-admin-bar-toggle-publish-draft', this.togglePublishDraftMode);
  //},
  //unmounted() {
  //  apos.bus.$off('command-menu-admin-bar-toggle-publish-draft', this.togglePublishDraftMode);
  //},
  methods: {
    //togglePublishDraftMode() {
    //  if (this.canTogglePublishDraftMode) {
    //    const mode = this.draftMode === 'draft' ? 'published' : 'draft';
    //    this.switchDraftMode(mode);
    //  }
    //},
    preview(mode, width) {
      this.$emit('switch-preview-mode', mode, width);
    }
  }
};
</script>
<style lang="scss" scoped>
</style>

