<template>
  <div
    data-apos-test="breakpointPreviewMode"
    class="apos-admin-bar__breakpoint-preview-mode"
  >
    <component
      :is="'AposButton'"
      v-for="(screen, name) in screens"
      :key="name"
      :data-apos-test="`breakpointPreviewMode:${name}`"
      :modifiers="['small', 'no-motion']"
      :label="screen.label"
      :title="$t(screen.label)"
      :icon="screen.icon"
      :icon-only="true"
      type="subtle"
      class="apos-admin-bar__breakpoint-preview-mode-button"
      :class="{ 'apos-is-active': mode === name }"
      @click="toggleBreakpointPreviewMode({ mode: name, label: screen.label, width: screen.width, height: screen.height })"
    />

    <AposContextMenu
      class="apos-admin-bar__breakpoint-preview-mode-dropdown"
      :button="button"
      :menu="screenItems"
      :center-on-icon="true"
      menu-placement="bottom-end"
      @item-clicked="emitEvent"
    >
      <template #prebutton>
        <div>icon</div>
      </template>
    </AposContextMenu>
  </div>
</template>
<script>

export default {
  name: 'TheAposContextBreakpointPreviewMode',
  props: {
    // { screenName: { label: string, width: string, height: string, icon: string } }
    screens: {
      type: Object,
      validator(value, props) {
        return Object.values(value).every(screen =>
          typeof screen.label === 'string' &&
          typeof screen.width === 'string' &&
          typeof screen.height === 'string' &&
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
  emits: [ 'switch-breakpoint-preview-mode', 'reset-breakpoint-preview-mode' ],
  data() {
    return {
      mode: null,
      originalBodyBackground: null,
      screenItems: []
    };
  },
  computed: {
    button() {
      return {
        class: 'apos-admin-bar__breakpoint-preview-mode-dropdown-btn',
        label: {
          key: 'toto',
          localize: false
        },
        icon: 'chevron-down-icon',
        modifiers: [ 'icon-right', 'no-motion' ],
        type: 'outline'
      };
    }
  },
  mounted() {
    apos.bus.$on('command-menu-admin-bar-toggle-breakpoint-preview-mode', this.toggleBreakpointPreviewMode);

    this.originalBodyBackground = window.getComputedStyle(document.querySelector('body'))?.background ||
      '#fff';

    const state = this.loadState();
    if (state.mode) {
      this.toggleBreakpointPreviewMode(state);
    }
  },
  unmounted() {
    apos.bus.$off('command-menu-admin-bar-toggle-breakpoint-preview-mode', this.toggleBreakpointPreviewMode);
  },
  methods: {
    switchBreakpointPreviewMode({
      mode,
      label,
      width,
      height
    }) {
      document.querySelector('body').setAttribute('data-breakpoint-preview-mode', mode);
      document.querySelector('[data-apos-refreshable]').setAttribute('data-resizable', this.resizable);
      document.querySelector('[data-apos-refreshable]').setAttribute('data-label', this.$t(label));
      document.querySelector('[data-apos-refreshable]').style.width = width;
      document.querySelector('[data-apos-refreshable]').style.height = height;
      document.querySelector('[data-apos-refreshable]').style.background = this.originalBodyBackground;

      this.mode = mode;
      this.$emit('switch-breakpoint-preview-mode', {
        mode,
        label,
        width,
        height
      });
      this.saveState({
        mode,
        label,
        width,
        height
      });
    },
    toggleBreakpointPreviewMode({
      mode,
      label,
      width,
      height
    }) {
      if (this.mode === mode || mode === null) {
        document.querySelector('body').removeAttribute('data-breakpoint-preview-mode');
        document.querySelector('[data-apos-refreshable]').removeAttribute('data-resizable');
        document.querySelector('[data-apos-refreshable]').removeAttribute('data-label');
        document.querySelector('[data-apos-refreshable]').style.removeProperty('width');
        document.querySelector('[data-apos-refreshable]').style.removeProperty('height');
        document.querySelector('[data-apos-refreshable]').style.removeProperty('background');

        this.mode = null;
        this.$emit('reset-breakpoint-preview-mode');
        this.saveState({ mode: this.mode });

        return;
      }

      this.switchBreakpointPreviewMode({
        mode,
        label,
        width,
        height
      });
    },
    loadState() {
      return JSON.parse(sessionStorage.getItem('aposBreakpointPreviewMode') || '{}');
    },
    saveState({
      mode = null,
      label = null,
      width = null,
      height = null
    } = {}) {
      const state = this.loadState();
      if (state.mode !== mode) {
        sessionStorage.setItem(
          'aposBreakpointPreviewMode',
          JSON.stringify({
            mode,
            label,
            width,
            height
          })
        );
      }
    }
  }
};
</script>
<style lang="scss" scoped>
.apos-admin-bar__breakpoint-preview-mode {
  display: flex;
  gap: $spacing-half;
  margin-left: $spacing-double;
}

.apos-admin-bar__breakpoint-preview-mode-button {
  &.apos-is-active {
    color: var(--a-text-primary);
    text-decoration: none;
    background-color: var(--a-base-10);
    border-radius: var(--a-border-radius);
    outline: 1px solid var(--a-base-7);
  }
}

.apos-admin-bar__breakpoint-preview-mode-dropdown {
  :deep(.apos-admin-bar__breakpoint-preview-mode-dropdown-btn .apos-button) {
    padding: 5px 10px;
    border-radius: 3px;
    border-color: var(--a-base-8);
  }
}
</style>
