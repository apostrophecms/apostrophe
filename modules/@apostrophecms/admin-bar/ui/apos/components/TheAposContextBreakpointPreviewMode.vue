<template>
  <div
    data-apos-test="breakpointPreviewMode"
    class="apos-admin-bar__breakpoint-preview-mode"
    :class="modifiers"
  >
    <div class="apos-admin-bar__breakpoint-preview-mode-shortcuts">
      <component
        :is="'AposButton'"
        v-for="(screen, name) in shortcuts"
        :key="name"
        :data-apos-test="`breakpointPreviewMode:${name}`"
        :modifiers="['small', 'no-motion']"
        :label="screen.label"
        :tooltip="$t(screen.label)"
        :title="$t(screen.label)"
        :icon="screen.icon"
        :icon-only="true"
        type="subtle"
        class="apos-admin-bar__breakpoint-preview-mode-button"
        :class="{ 'apos-is-active': mode === name }"
        @click="toggleBreakpointPreviewMode({
          mode: name,
          label: screen.label,
          width: screen.width,
          height: screen.height
        })"
      />
    </div>

    <AposContextMenu
      v-if="showDropdown"
      class="apos-admin-bar__breakpoint-preview-mode-dropdown"
      :button="button"
      :menu="breakpoints"
      :active-item="mode"
      :center-on-icon="true"
      menu-placement="bottom-end"
      @item-clicked="selectBreakpoint"
    />
    <Transition>
      <AposButton
        v-show="activeScreen"
        tooltip="apostrophe:breakpointPreviewClear"
        :icon-only="true"
        icon="close-icon"
        :modifiers="['small', 'no-motion']"
        label="apostrophe:breakpointPreviewClear"
        type="subtle"
        @click="toggleBreakpointPreviewMode({
          mode,
          ...activeScreen
        })"
      />
    </Transition>
  </div>
</template>
<script>
export default {
  name: 'TheAposContextBreakpointPreviewMode',
  props: {
    // { screenName: { label: string, width: string, height: string, icon:
    // string } }
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
      shortcuts: this.getShortcuts(),
      breakpoints: this.getBreakpointItems(),
      showDropdown: false,
      bodyEl: null,
      refreshableBodyEl: null,
      observer: new MutationObserver(this.observerCallback)
    };
  },
  computed: {
    activeScreen() {
      return this.mode && this.screens[this.mode];
    },
    button() {
      let className = 'apos-admin-bar__breakpoint-preview-mode-dropdown-btn';
      if (!this.activeScreen) {
        className += ' apos-admin-bar__breakpoint-preview-mode-dropdown-btn--inactive';
      }
      return {
        class: className,
        label: {
          key: this.activeScreen?.label || 'apostrophe:breakpointPreviewSelect',
          localize: true
        },
        icon: 'chevron-down-icon',
        secondIcon: this.activeScreen
          ? this.getScreenIcon(this.activeScreen)
          : null,
        modifiers: [ 'icon-right', 'no-motion' ],
        type: 'outline'
      };
    },
    modifiers() {
      const base = 'apos-admin-bar__breakpoint-preview-mode';
      const result = [];

      if (!Object.keys(this.shortcuts).length) {
        result.push(`${base}--no-shortcuts`);
      }

      if (!this.showDropdown) {
        result.push(`${base}--no-dropdown`);
      }

      return result;
    }
  },
  mounted() {
    this.bodyEl = document.querySelector('body');
    this.setShowDropdown();
    apos.bus.$on(
      'command-menu-admin-bar-toggle-breakpoint-preview-mode',
      this.toggleBreakpointPreviewMode
    );

    this.originalBodyBackground = window.getComputedStyle(document.querySelector('body'))
      ?.background || '#fff';

    const state = this.loadState();
    if (state.mode) {
      this.toggleBreakpointPreviewMode(state);
    }
  },
  unmounted() {
    apos.bus.$off(
      'command-menu-admin-bar-toggle-breakpoint-preview-mode',
      this.toggleBreakpointPreviewMode
    );
  },
  methods: {
    observerCallback(mutationList, observer) {
      for (const mutation of mutationList) {
        if (
          mutation.type !== 'attributes' ||
          mutation.attributeName.startsWith('data-apos') ||
          mutation.attributeName === 'data-breakpoint-preview-mode'
        ) {
          continue;
        }
        const bodyAttribute = mutation.target
          .getAttribute(mutation.attributeName);
        this.refreshableBodyEl.setAttribute(mutation.attributeName, bodyAttribute);
      }
    },

    createFakeBody(refreshableEl) {
      this.refreshableBodyEl = document.createElement('div');
      this.refreshableBodyEl.setAttribute('data-apos-refreshable-body', '');
      Array.from(refreshableEl.childNodes).forEach(child => {
        this.refreshableBodyEl.append(child);
      });

      Array.from(this.bodyEl.attributes || {})
        .filter(({ name }) => !name.startsWith('data-apos'))
        .forEach(({ name, value }) => {
          this.refreshableBodyEl.setAttribute(name, value);
        });

      refreshableEl.append(this.refreshableBodyEl);
    },

    switchBreakpointPreviewMode({
      mode,
      label,
      width,
      height
    }) {
      const refreshableEl = document.querySelector('[data-apos-refreshable]');

      // Only when switching to mobile preview from the normal state
      if (!this.mode) {
        this.createFakeBody(refreshableEl);
        this.observer.observe(this.bodyEl, { attributes: true });
      }

      this.bodyEl.setAttribute('data-breakpoint-preview-mode', mode);
      refreshableEl.setAttribute('data-resizable', this.resizable);
      refreshableEl.setAttribute('data-label', this.$t(label));
      refreshableEl.style.width = width;
      refreshableEl.style.height = height;

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
    toggleBreakpointPreviewMode(state) {
      if (this.mode === state.mode || state.mode === null) {
        this.resetBreakpointPreview();
        return;
      }

      this.switchBreakpointPreviewMode(state);
    },
    resetBreakpointPreview() {
      const refreshableEl = document.querySelector('[data-apos-refreshable]');

      this.observer.disconnect();
      if (!this.refreshableBodyEl) {
        return;
      }

      Array.from(this.refreshableBodyEl.childNodes).forEach(child => {
        if (child.nodeType !== Node.TEXT_NODE || child.nodeValue.trim()) {
          refreshableEl.append(child);
        }
      });
      this.refreshableBodyEl.remove();
      this.refreshableBodyEl = null;

      this.bodyEl.removeAttribute('data-breakpoint-preview-mode');
      refreshableEl.removeAttribute('data-resizable');
      refreshableEl.removeAttribute('data-label');
      refreshableEl.style.removeProperty('width');
      refreshableEl.style.removeProperty('height');

      this.mode = null;
      this.$emit('reset-breakpoint-preview-mode');
      this.saveState({ mode: this.mode });
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
    },
    getShortcuts() {
      return Object.fromEntries(
        Object.entries(this.screens).filter(([ _, { shortcut } ]) => shortcut)
      );
    },
    getBreakpointItems() {
      return Object.entries(this.screens).map(([ name, screen ]) => ({
        name,
        action: name,
        label: screen.label,
        width: screen.width,
        height: screen.height,
        icon: this.getScreenIcon(screen)
      }));
    },
    getScreenIcon(screen) {
      if (screen.icon) {
        return screen.icon;
      }

      const width = parseInt(screen.width);
      if (width > 1024) {
        return 'monitor-icon';
      } else if (width > 540) {
        return 'tablet-icon';
      }
      return 'cellphone-icon';
    },
    selectBreakpoint(item) {
      const {
        name, label, width, height
      } = this.breakpoints.find(({ name }) => name === item.action);
      this.toggleBreakpointPreviewMode({
        mode: name,
        label,
        width,
        height
      });
    },
    setShowDropdown() {
      this.showDropdown = Object.values(this.screens).some(({ shortcut }) => !shortcut);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-admin-bar__breakpoint-preview-mode {
  display: flex;
  gap: $spacing-one-quarter;
  align-items: center;
  margin-left: $spacing-base;

  &:not(&--no-dropdown) .apos-admin-bar__breakpoint-preview-mode-shortcuts {
    display: none;

    @include media-up(hands-wide) {
      display: flex;
    }
  }
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
    padding: $spacing-three-quarters;
    border-radius: var(--a-border-radius);
    border-color: var(--a-base-8);

    &.apos-is-active {
      background-color: transparent;
    }

    .apos-button__icon {
      margin-left: $spacing-base;
    }

    .apos-button__second-icon {
      margin-right: $spacing-three-quarters;
    }

    .apos-button__label {
      white-space: pre;
    }
  }

  :deep(.apos-admin-bar__breakpoint-preview-mode-dropdown-btn--inactive .apos-button) {
    padding-left: $spacing-base;
    font-style: italic;
    color: var(--a-base-2);
  }
}

.v-enter-active,
.v-leave-active {
  @include apos-transition($duration:0.3s);
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}

.apos-admin-bar__breakpoint-preview-mode-shortcuts {
  display: flex;
}

</style>
