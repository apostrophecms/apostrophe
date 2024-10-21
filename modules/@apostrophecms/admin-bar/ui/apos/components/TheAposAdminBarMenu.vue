<template>
  <ol class="apos-admin-bar__items" role="menu">
    <li v-if="pageTree" class="apos-admin-bar__item">
      <AposButton
        type="subtle"
        label="apostrophe:pages"
        class="apos-admin-bar__btn"
        :modifiers="['no-motion']"
        role="menuitem"
        @click="emitEvent('@apostrophecms/page:manager')"
      />
    </li>
    <li
      v-for="item in menuItems"
      :key="item.name"
      class="apos-admin-bar__item"
    >
      <AposContextMenu
        v-if="item.items"
        class="apos-admin-bar__sub"
        :menu="item.items"
        :button="{
          label: item.label,
          modifiers: ['no-motion'],
          class: 'apos-admin-bar__btn',
          type: 'subtle'
        }"
        role="menuitem"
        @item-clicked="emitEvent"
      />
      <Component
        :is="item.options && item.options.component || 'AposButton'"
        v-else
        type="subtle"
        :label="item.label"
        :modifiers="['no-motion']"
        class="apos-admin-bar__btn"
        role="menuitem"
        @click="emitEvent(item.action)"
      />
    </li>
    <li v-if="createMenu.length > 0" class="apos-admin-bar__item">
      <AposContextMenu
        class="apos-admin-bar__create"
        :menu="createMenu"
        :button="{
          label: 'apostrophe:newItem',
          iconOnly: true,
          icon: 'plus-icon',
          type: 'primary',
          modifiers: ['round', 'no-motion']
        }"
        role="menuitem"
        @item-clicked="emitEvent"
      />
    </li>
    <li
      v-if="trayItems.length > 0"
      class="apos-admin-bar__item apos-admin-bar__tray-items"
    >
      <template v-for="item in trayItems">
        <Component
          :is="item.options.component"
          v-if="item.options.component"
          :key="`${item.name}.component`"
        />
        <AposButton
          v-else
          :key="`${item.name}.fallback`"
          type="subtle"
          :modifiers="['small', 'no-motion']"
          :tooltip="trayItemTooltip(item)"
          class="apos-admin-bar__context-button"
          :icon="item.options.icon"
          :icon-only="true"
          :label="item.label"
          :action="item.action"
          :state="trayItemState[item.name] ? [ 'active' ] : []"
          @click="emitEvent(item.action)"
        />
      </template>
    </li>
  </ol>
</template>

<script>
import { klona } from 'klona';

export default {
  name: 'TheAposAdminBarMenu',
  props: {
    items: {
      type: Array,
      default: function () {
        return [];
      }
    }
  },
  data() {
    return {
      createMenu: [],
      menuItems: [],
      trayItems: [],
      trayItemState: {}
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.adminBar;
    },
    pageTree() {
      return this.moduleOptions.pageTree;
    }
  },
  async mounted() {
    apos.bus.$on('admin-menu-click', this.onAdminMenuClick);

    const itemsSet = klona(this.items);
    this.menuItems = itemsSet.filter(item => !(item.options && item.options.contextUtility))
      .map(item => {
        if (item.items) {
          item.items.forEach(subitem => {
            // The context menu needs an `action` property to emit.
            subitem.action = subitem.action || subitem.name;
          });
        }
        return item;
      });
    this.trayItems = itemsSet.filter(item => item.options && item.options.contextUtility);

    Object.values(apos.modules).forEach(apostropheModule => {
      if (apostropheModule.quickCreate) {
        this.createMenu.push({
          label: apostropheModule.label || apostropheModule.name,
          name: apostropheModule.name,
          action: `${apostropheModule.name}:editor`
        });
      }
    });
  },
  methods: {
    emitEvent(name) {
      apos.bus.$emit('admin-menu-click', name);
    },
    trayItemTooltip(item) {
      if (item.options.toggle) {
        if (this.trayItemState[item.name] && item.options.tooltip && item.options.tooltip.deactivate) {
          return {
            content: item.options.tooltip.deactivate,
            placement: 'bottom'
          };
        } else if (item.options.tooltip && item.options.tooltip.activate) {
          return {
            content: item.options.tooltip.activate,
            placement: 'bottom'
          };
        } else {
          return false;
        }
      } else {
        return item.options.tooltip;
      }
    },
    // Maintain a knowledge of which tray item toggles are active
    onAdminMenuClick(e) {
      const name = e.itemName || e;
      const trayItem = this.trayItems.find(item => item.name === name);
      if (trayItem && trayItem.options.toggle) {
        this.trayItemState = {
          ...this.trayItemState,
          [name]: !this.trayItemState[name]
        };
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-admin-bar__items {
  display: flex;
  flex-grow: 1;
  line-height: var(--a-line-base);
  margin: 0;
  padding: 0;
}

.apos-admin-bar__item {
  display: inline-flex;
  align-items: center;
}

.apos-admin-bar__sub :deep(.apos-context-menu__btn) {
  border-radius: 0;
}

.apos-admin-bar__sub :deep(.apos-context-menu__popup) {
  top: calc(100% + 5px);
}

:deep(.apos-admin-bar__create) {
  margin-left: 10px;

  .apos-context-menu__btn {
    width: 21px;
    height: 21px;
  }

  .apos-context-menu__btn .apos-button {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .apos-context-menu__popup {
    top: calc(100% + 13px);
  }
}

.apos-admin-bar__tray-items {
  margin-left: auto;
  padding: 4px;
}

</style>
