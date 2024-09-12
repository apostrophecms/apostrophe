<template>
  <div
    data-apos-test="devicePreviewMode"
    class="apos-admin-bar__device-preview-mode"
  >
    <component
      :is="'AposButton'"
      v-for="(screen, name) in screens"
      :key="name"
      :data-apos-test="`devicePreviewMode:${name}`"
      :modifiers="['small', 'no-motion']"
      :label="screen.label"
      :icon="screen.icon"
      :icon-only="true"
      type="subtle"
      class="apos-admin-bar__device-preview-mode-button"
      :class="{ 'apos-is-active': mode === name }"
      @click="toggleDevicePreviewMode(name, screen.minWidth)"
    />
  </div>
</template>
<script>

// TODO: add i18n keys
// TODO: add keyboard shortcuts for device preview mode
// TODO: fix active style
export default {
  name: 'TheAposContextDevicePreview',
  props: {
    // { screenName: { label: string, minWidth: number, icon: string } }
    screens: {
      type: Object,
      validator(value, props) {
        return Object.values(value).every(screen =>
          typeof screen.label === 'string' &&
          typeof screen.minWidth === 'number' &&
          typeof screen.icon === 'string'
        );
      },
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
  mounted() {
    apos.bus.$on('command-menu-admin-bar-toggle-device-preview-mode', this.toggleDevicePreviewMode);
  },
  unmounted() {
    apos.bus.$off('command-menu-admin-bar-toggle-device-preview-mode', this.toggleDevicePreviewMode);
  },
  methods: {
    switchDevicePreviewMode(mode, width) {
      document.querySelector('[data-apos-refreshable]').setAttribute('device-preview-mode', mode);
      document.querySelector('[data-apos-refreshable]').setAttribute('resizable', this.resizable);
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
.apos-admin-bar__device-preview-mode {
  margin-left: 22px;
}

.apos-admin-bar__device-preview-mode-button {
  & + & {
    margin-left: 6px;
  }

  // &.active {
  //   color: var(--a-text-primary);
  //   text-decoration: none;
  //   background-color: var(--a-base-10);
  //   outline: 1px solid var(--a-base-7);
  // }
}
</style>
