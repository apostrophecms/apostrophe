<template>
  <div
    data-apos-test="devicePreview"
    class="apos-admin-bar"
  >
    <component
      :is="'AposButton'"
      v-for="(screen, name) in screens"
      :key="name"
      :data-apos-test="name"
      :modifiers="['small', 'no-motion']"
      :label="screen.label"
      :icon="screen.icon"
      :icon-only="true"
      type="subtle"
      class="apos-admin-bar__context-button"
      @click="toggleDevicePreviewMode(name, screen.minWidth)"
    />
  </div>
</template>
<script>

export default {
  name: 'TheAposContextDevicePreview',
  props: {
    screens: {
      type: Object,
      // TODO: validator
      // validator(value, props) {
      //   return props.resizable && props.screens;
      // },
      default: () => {
        return {};
      }
    },
    resizable: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'switch-device-preview-mode', 'reset-device-preview-mode' ],
  data() {
    return {
      mode: null
    };
  },
  computed: {
    // screens() {
    //   // TODO: set from asset options
    //   // TODO: set toggle mode
    //   // TODO: set :data-apos-test="preview-${screen.id}"
    //   return [
    //     {
    //       id: 'desktop',
    //       label: 'apostrophe:previewDesktop',
    //       icon: 'monitor-icon',
    //       width: 1024
    //     },
    //     {
    //       id: 'tablet',
    //       label: 'apostrophe:previewTablet',
    //       icon: 'tablet-icon',
    //       width: 640
    //     },
    //     {
    //       id: 'phone',
    //       label: 'apostrophe:previewPhone',
    //       icon: 'cellphone-icon',
    //       width: 480
    //     }
    //   ];
    // }
  },
  // mounted() {
  //   // TODO: add keyboard shortcuts for device preview mode
  //   apos.bus.$on('command-menu-admin-bar-toggle-publish-draft', this.togglePublishDraftMode);
  // },
  // unmounted() {
  //   // TODO: remove keyboard shortcuts for device preview mode
  //   apos.bus.$off('command-menu-admin-bar-toggle-publish-draft', this.togglePublishDraftMode);
  // },
  methods: {
    switchDevicePreviewMode(mode, width) {
      document.querySelector('[data-apos-refreshable]').setAttribute('device-preview-mode', mode);
      document.querySelector('[data-apos-refreshable]').style.width = `${width}px`;
      this.mode = mode;
      this.$emit('switch-device-preview-mode', mode, width);
    },
    toggleDevicePreviewMode(mode, width) {
      if (this.mode === mode) {
        document.querySelector('[data-apos-refreshable]').removeAttribute('device-preview-mode');
        document.querySelector('[data-apos-refreshable]').style.removeProperty('width');
        this.mode = null;
        this.$emit('reset-device-preview-mode');

        return;
      }

      this.switchDevicePreviewMode(mode, width);
    }
  }
};
</script>
<style lang="scss" scoped>
</style>
