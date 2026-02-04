<template>
  <div
    ref="containerEl"
    class="apos-modal-tabs"
  >
    <ul
      class="apos-modal-tabs__tabs"
      data-apos-test="widget-tabs"
      :class="{ 'apos-modal-tabs__tabs--with-menu': hasMenu }"
      :style="menuPaddingStyle"
    >
      <li
        v-for="tab in visibleTabs"
        v-show="tab.isVisible !== false"
        :key="tab.name"
        class="apos-modal-tabs__tab"
        data-apos-test="widget-tabs-item"
      >
        <button
          :id="tab.name"
          class="apos-modal-tabs__btn"
          :aria-selected="tab.name === current ? true : false"
          data-apos-test="widget-tabs-button"
          @click="selectTab"
        >
          {{ $t(tab.label) }}
          <span
            v-if="tabErrors[tab.name] && tabErrors[tab.name].length"
            class="apos-modal-tabs__label apos-modal-tabs__label--error"
            data-apos-test="widget-tabs-error"
          >
            {{ tabErrors[tab.name].length }}&nbsp;{{
              generateErrorLabel(tabErrors[tab.name].length) }}
          </span>
        </button>
      </li>
    </ul>

    <!-- Offscreen render for measuring tab widths -->
    <ul
      class="apos-modal-tabs__tabs apos-modal-tabs__tabs--measure"
      aria-hidden="true"
    >
      <li
        v-for="tab in renderableTabs"
        :key="`measure-${tab.name}`"
        :ref="(el) => setMeasureTabEl(tab.name, el)"
        class="apos-modal-tabs__tab"
      >
        <button
          class="apos-modal-tabs__btn"
          tabindex="-1"
          type="button"
        >
          {{ $t(tab.label) }}
          <span
            v-if="tabErrors[tab.name] && tabErrors[tab.name].length"
            class="apos-modal-tabs__label apos-modal-tabs__label--error"
          >
            {{ tabErrors[tab.name].length }}&nbsp;{{
              generateErrorLabel(tabErrors[tab.name].length) }}
          </span>
        </button>
      </li>
    </ul>

    <AposContextMenu
      v-show="hasMenu && menuTabs.length"
      ref="moreMenuEl"
      :menu="menuTabs"
      menu-placement="bottom-end"
      :button="moreMenuButton"
      data-apos-test="context-menu-tabs"
      @item-clicked="moreMenuHandler($event)"
    />
  </div>
</template>

<script>
const MENU_WIDTH_FALLBACK_PX = 45;

export default {
  name: 'AposWidgetModalTabs',
  props: {
    tabs: {
      required: true,
      type: Array
    },
    current: {
      type: String,
      default: ''
    },
    errors: {
      type: Object,
      default() {
        return {};
      }
    },
    orientation: {
      type: String,
      default: 'vertical'
    }
  },
  emits: [ 'select-tab' ],
  data() {
    return {
      // Measured tab layout state
      hasMenu: false,
      menuButtonWidth: MENU_WIDTH_FALLBACK_PX,
      visibleTabNames: null,
      measureTabEls: {},
      resizeObserver: null,
      moreMenuButton: {
        icon: 'dots-vertical-icon',
        iconOnly: true,
        type: 'subtle'
      }
    };
  },
  computed: {
    renderableTabs() {
      return (this.tabs || []).filter(tab => tab.isVisible !== false);
    },
    tabErrors() {
      const errors = {};
      for (const key in this.errors) {
        errors[key] = [];
        for (const errorKey in this.errors[key]) {
          if (this.errors[key][errorKey]) {
            errors[key].push(key);
          }
        }
      }
      return errors;
    },
    visibleTabs() {
      if (!this.hasMenu) {
        return this.renderableTabs;
      }
      if (!Array.isArray(this.visibleTabNames) || !this.visibleTabNames.length) {
        return this.renderableTabs;
      }
      const visible = new Set(this.visibleTabNames);
      return this.renderableTabs.filter(tab => visible.has(tab.name));
    },
    hiddenTabs() {
      if (!this.hasMenu) {
        return [];
      }
      const visible = new Set((this.visibleTabs || []).map(t => t.name));
      return this.renderableTabs.filter(tab => !visible.has(tab.name));
    },
    menuTabs() {
      return this.hiddenTabs.map((tab) => {
        const modifiers = [];
        if (tab.name === this.current) {
          modifiers.push('selected');
          if (!this.tabErrors[tab.name] || !this.tabErrors[tab.name].length) {
            modifiers.push('primary');
          }
        }
        if (this.tabErrors[tab.name] && this.tabErrors[tab.name].length) {
          modifiers.push('danger');
        }
        return {
          ...tab,
          action: tab.name,
          modifiers
        };
      });
    },
    menuPaddingStyle() {
      if (!this.hasMenu) {
        return null;
      }
      const width = this.menuButtonWidth || MENU_WIDTH_FALLBACK_PX;
      return { paddingRight: `${width}px` };
    }
  },
  watch: {
    tabs: {
      handler() {
        this.recalculateLayout();
      },
      deep: true
    },
    current() {
      // Ensure current tab stays visible when possible
      this.recalculateLayout();
    }
  },
  async mounted() {
    this.resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => this.recalculateLayout())
      : null;

    if (this.resizeObserver && this.$refs.containerEl) {
      this.resizeObserver.observe(this.$refs.containerEl);
    } else {
      window.addEventListener('resize', this.recalculateLayout);
    }

    await this.recalculateLayout();
  },
  beforeUnmount() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    } else {
      window.removeEventListener('resize', this.recalculateLayout);
    }
  },
  methods: {
    setMeasureTabEl(name, el) {
      if (!name) {
        return;
      }
      if (!el) {
        delete this.measureTabEls[name];
        return;
      }
      this.measureTabEls[name] = el;
    },
    generateErrorLabel(errorCount) {
      return errorCount > 1
        ? this.$t('apostrophe:modalTabsErrors')
        : this.$t('apostrophe:modalTabsError');
    },
    getMenuButtonWidth() {
      const menuRoot = this.$refs.moreMenuEl?.$el;
      const button = menuRoot?.querySelector?.('.apos-button');
      const width = button?.getBoundingClientRect?.().width || button?.offsetWidth;
      return width || MENU_WIDTH_FALLBACK_PX;
    },
    async recalculateLayout() {
      await this.$nextTick();

      const container = this.$refs.containerEl;
      const containerRectWidth = container?.getBoundingClientRect?.().width;
      const containerWidth = containerRectWidth || container?.clientWidth || 0;
      if (!containerWidth) {
        return;
      }

      const tabs = this.renderableTabs;
      if (!tabs.length) {
        this.hasMenu = false;
        this.visibleTabNames = [];
        return;
      }

      // Measure each tab width from the offscreen list.
      const widths = tabs.map((tab) => {
        const el = this.measureTabEls[tab.name];
        return el?.getBoundingClientRect?.().width || el?.offsetWidth || 0;
      });
      const totalTabsWidth = widths.reduce((sum, w) => sum + w, 0);

      // Reserve space for the menu button so tabs never overlap it.
      // Use fallback until we can measure the real button (after menu is shown).
      const reservedForMenu = this.menuButtonWidth || MENU_WIDTH_FALLBACK_PX;
      const availableWidth = Math.max(
        0,
        containerWidth - reservedForMenu
      );

      // First pass: if everything fits in the space left for the menu, no menu needed.
      if (totalTabsWidth <= availableWidth) {
        this.hasMenu = false;
        this.visibleTabNames = tabs.map(t => t.name);
        return;
      }

      // We need the menu; render it so we can measure the real button width.
      this.hasMenu = true;
      await this.$nextTick();
      this.menuButtonWidth = this.getMenuButtonWidth();

      // Recompute available width with measured button width for accurate tab count.
      const effectiveMenuWidth = this.menuButtonWidth || MENU_WIDTH_FALLBACK_PX;
      const fitAvailableWidth = Math.max(
        0,
        containerWidth - effectiveMenuWidth
      );

      // Determine how many tabs fit (in order).
      const visibleNames = [];
      let used = 0;
      for (let i = 0; i < tabs.length; i++) {
        const w = widths[i] || 0;
        // Always show at least one tab.
        if (!visibleNames.length || (used + w) <= fitAvailableWidth) {
          visibleNames.push(tabs[i].name);
          used += w;
        } else {
          break;
        }
      }

      // Keep the current tab visible when possible (e.g. after selecting from menu).
      if (this.current && !visibleNames.includes(this.current)) {
        if (visibleNames.length) {
          visibleNames[visibleNames.length - 1] = this.current;
        } else {
          visibleNames.push(this.current);
        }
      }

      // After swapping in current, the new tab may be wider and exceed fit space.
      // Trim from the end (never remove current) until we fit within menu-reserved space.
      const visibleNamesSet = Array.from(new Set(visibleNames));
      const widthFor = (name) =>
        widths[tabs.findIndex(t => t.name === name)] ?? 0;
      let totalVisibleWidth =
        visibleNamesSet.reduce((sum, name) => sum + widthFor(name), 0);
      while (totalVisibleWidth > fitAvailableWidth && visibleNamesSet.length > 1) {
        let removed = false;
        for (let i = visibleNamesSet.length - 1; i >= 0; i--) {
          if (visibleNamesSet[i] !== this.current) {
            totalVisibleWidth -= widthFor(visibleNamesSet[i]);
            visibleNamesSet.splice(i, 1);
            removed = true;
            break;
          }
        }
        if (!removed) {
          break;
        }
      }

      this.visibleTabNames = visibleNamesSet;
    },
    selectTab (e) {
      // Use currentTarget so clicks on nested elements still resolve the button id.
      const id = e.currentTarget?.id;
      this.$emit('select-tab', id);
    },
    moreMenuHandler(item) {
      this.$emit('select-tab', item.action);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-modal-tabs {
  position: relative;
  display: flex;
  height: 100%;
  background-color: var(--a-base-10);
}

:deep(.apos-context-menu) {
  position: absolute;
  top: 0;
  right: 0;

  svg {
    width: 20px;
    height: 20px;
    color: var(--a-base-1);
  }

  .apos-button {
    box-sizing: border-box;
    height: 45px;
  }

  .apos-button--subtle:hover {
    background-color: initial;
  }
}

.apos-modal-tabs__tabs {
  position: relative;
  display: flex;
  flex-direction: row;
  width: 100%;
  margin: 0;
  padding: 0;
  border-bottom: 1px solid var(--a-base-9);
}

.apos-modal-tabs__tabs--measure {
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
  height: 0;
  white-space: nowrap;
}

.apos-modal-tabs__tab {
  display: flex;
}

.apos-modal-tabs__label {
  display: inline-block;
  padding: 3px;
  border: 1px solid var(--a-base-0);
  font-size: var(--a-type-tiny);
  border-radius: 4px 3px;
  text-transform: uppercase;
  letter-spacing: 1px;
  pointer-events: none;
}

.apos-modal-tabs__label--error {
  margin-left: 5px;
  border: 1px solid var(--a-danger);
}

.apos-modal-tabs__btn {
  @include apos-button-reset();
  @include type-base;

  & {
    position: relative;
    display: flex;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 45px;
    padding: 0 15px;
    color: var(--a-base-3);
    transition: all 200ms ease;
    cursor: pointer;

    &::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      width: 100%;
      height: 0;
      background-color: var(--a-primary);
      transition: height 200ms ease;
    }

    &:hover, &:focus {
      color: var(--a-text-primary);
    }

    &[aria-selected='true']::after {
      height: 2px;
    }

    &[aria-selected='true'],
    &[aria-selected='true']:hover,
    &[aria-selected='true']:focus {
      color: var(--a-text-primary);
    }
  }
}
</style>
