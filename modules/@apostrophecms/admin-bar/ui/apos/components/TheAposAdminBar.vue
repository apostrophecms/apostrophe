<template>
  <div class="apos-admin-bar-wrapper">
    <div class="apos-admin-bar-spacer" ref="spacer" />
    <nav class="apos-admin-bar" ref="adminBar">
      <div class="apos-admin-bar__row">
        <AposLogoPadless class="apos-admin-bar__logo" />
        <ul class="apos-admin-bar__items">
          <li class="apos-admin-bar__item" v-if="createMenu.length > 0">
            <AposButton
              type="default" label="Page Tree"
              icon="file-tree-icon" class="apos-admin-bar__btn"
              @click="emitEvent('@apostrophecms/page:manager')"
            />
          </li>
          <li
            v-for="item in menuItems" :key="item.name"
            class="apos-admin-bar__item"
          >
            <AposButton
              v-if="item.options" type="quiet"
              @click="emitEvent(item.action)"
              :label="item.label"
              :modifiers="['no-motion']"
              class="apos-admin-bar__btn"
            />
            <AposContextMenu
              v-else-if="item.items" class="apos-admin-bar__sub"
              :menu="item.items" :button="{
                label: item.label,
                modifiers: ['no-motion']
              }"
              @item-clicked="emitEvent"
            />
          </li>
          <li class="apos-admin-bar__item" v-if="createMenu.length > 0">
            <AposContextMenu
              class="apos-admin-bar__create"
              :menu="createMenu"
              :button="{
                label: 'New item',
                iconOnly: true,
                icon: 'plus-icon',
                type: 'primary',
                modifiers: ['round', 'no-motion'],
                iconSize: 10
              }"
              @item-clicked="emitEvent"
            />
          </li>
        </ul>
        <TheAposAdminBarUser
          class="apos-admin-bar__user"
        />
      </div>
      <div class="apos-admin-bar__row">
        <span class="apos-admin-bar__context-spacer" />
        <span class="apos-admin-bar__context-title">
          <information-outline-icon />
          {{ moduleOptions.context.title }}
        </span>
        <span class="apos-admin-bar__context-controls">
          <AposButton
            v-if="editMode"
            type="default" label="Preview Mode"
            icon="eye-icon" class="apos-admin-bar__btn"
            :icon-only="true"
            @click="switchToPreviewMode"
          />
          <AposButton
            v-if="!editMode"
            type="default" label="Edit Mode"
            icon="pencil-icon" class="apos-admin-bar__btn"
            :icon-only="true"
            @click="switchToEditMode"
          />
          <AposButton
            v-if="moduleOptions.contextId"
            type="default" label="Page Settings"
            icon="cog-icon" class="apos-admin-bar__btn"
            :icon-only="true"
            @click="emitEvent({
              itemName: contextEditorName,
              props: {
                docId: moduleOptions.contextId
              }
            })"
          />
          <AposButton
            type="primary" label="Publish Changes"
            :disabled="!readyToSave"
            class="apos-admin-bar__btn"
            @click="save"
          />
        </span>
      </div>
    </nav>
  </div>
</template>

<script>
import klona from 'klona';

export default {
  name: 'TheAposAdminBar',
  props: {
    items: {
      type: Array,
      default: function () {
        return [];
      }
    }
  },
  emits: [ 'admin-menu-click' ],
  data() {
    return {
      menuItems: [],
      createMenu: [],
      patches: [],
      editMode: window.sessionStorage.getItem('aposEditMode') === 'true',
      idleTimer: undefined,
      idleTriggered: false
    };
  },
  computed: {
    currentPageId() {
      if (apos.page && apos.page.page && apos.page.page._id) {
        return apos.page.page._id;
      }
      return false;
    },
    readyToSave() {
      return this.patches.length;
    },
    moduleOptions() {
      return window.apos.adminBar;
    },
    contextEditorName() {
      return this.moduleOptions.contextEditorName;
    }
  },
  watch: {
    async idleTriggered(newVal, oldVal) {
      if (newVal && !oldVal) {
        const response = await apos.confirm({
          heading: 'You have been idle for 30 minutes with unsaved changes. Please save to avoid losing your updates.',
          negativeLabel: false,
          affirmativeLabel: 'Okay',
          icon: false
        });

        if (response) {
          this.resetTimer();
        }
      }
    }
  },
  mounted() {
    this.$refs.spacer.style.height = `${this.$refs.adminBar.offsetHeight}px`;
    const itemsSet = klona(this.items);

    this.menuItems = itemsSet.map(item => {
      if (item.items) {
        item.items.forEach(subitem => {
          // The context menu needs an `action` property to emit.
          subitem.action = subitem.action || subitem.name;
        });
      }
      return item;
    });

    Object.values(apos.modules).forEach(module => {
      if (module.quickCreate) {
        this.createMenu.push({
          label: module.label || module.name,
          name: module.name,
          action: `${module.name}:editor`
        });
      }
    });

    apos.bus.$on('context-edited', patch => {
      this.patches.push(patch);
    });

    window.addEventListener('beforeunload', this.beforeUnload);
    window.addEventListener('storage', (e) => {
      if (e.storageArea === sessionStorage && e.key === 'aposEditMode') {
        this.editMode = e.newValue;
      }
    });

    apos.bus.$on('content-changed', async () => {
      this.refresh();
    });

    if (this.editMode) {
      // The page always initially loads with fully rendered content,
      // so refetch the content with the area placeholders and data instead
      this.resetTimer();
      this.refresh();
    }
  },
  methods: {
    beforeUnload(e) {
      if (this.patches.length) {
        e.preventDefault();
        // No actual control over the message is possible in modern browsers,
        // but Chrome requires we set a string here
        e.returnValue = '';
      }
    },
    emitEvent: function (name) {
      apos.bus.$emit('admin-menu-click', name);
    },
    async save() {
      await apos.http.patch(`${window.apos.doc.action}/${this.moduleOptions.contextId}`, {
        body: {
          _patches: this.patches
        },
        busy: true
      });
      this.patches = [];
      this.resetTimer();
    },
    switchToEditMode() {
      window.sessionStorage.setItem('aposEditMode', 'true');
      this.editMode = true;
      this.resetTimer();
      this.refresh();
    },
    switchToPreviewMode() {
      window.sessionStorage.setItem('aposEditMode', 'false');
      this.editMode = false;
      this.idleTriggered = false;
      clearTimeout(this.idleTimer);
      this.idleTimer = null;

      this.refresh();
    },
    async refresh() {
      const content = await apos.http.get(window.location.href, {
        headers: {
          'Cache-Control': 'no-cache'
        },
        qs: {
          ...apos.http.parseQuery(window.location.search),
          'apos-refresh': '1',
          ...(this.editMode ? {
            'apos-edit': '1'
          } : {})
        }
      });
      const refreshable = document.querySelector('[data-apos-refreshable]');
      if (refreshable) {
        refreshable.innerHTML = content;
      }
      apos.bus.$emit('refreshed');
    },
    resetTimer () {
      this.idleTriggered = false;
      clearTimeout(this.idleTimer);

      const self = this;

      this.idleTimer = setTimeout(() => {
        self.idleTriggered = true;
      }, 1800000);
    }
  }
};
</script>

<style lang="scss" scoped>
$menu-row-height: 50px;
$menu-v-pad: 18px;
$menu-h-space: 12px;
$menu-v-space: 25px;
$admin-bar-h-pad: 20px;
$admin-bar-border: 1px solid var(--a-base-9);

.apos-admin-bar-wrapper {
  z-index: $z-index-admin-bar;
  position: relative;
}

.apos-admin-bar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  background: var(--a-background-primary);
}

.apos-admin-bar__row {
  display: flex;
  align-items: center;
  height: $menu-row-height;
  padding: 0 $admin-bar-h-pad 0 0;
  border-bottom: $admin-bar-border;
}

.apos-admin-bar__context-spacer {
  flex: 1;
  // Using text-align because otherwise we don't wind
  // up with quite the right centering for the middle one
  // due to subtle issues with the way space is
  // distributed
  text-align: left;
}

.apos-admin-bar__context-title {
  flex: 1;
  text-align: center;
}

.apos-admin-bar__context-controls {
  flex: 1;
  text-align: right;
}

.apos-admin-bar__items {
  display: flex;
  margin: 0;
  padding: 0;
}

.apos-admin-bar__logo {
  margin-left: $admin-bar-h-pad;
}

.apos-admin-bar__logo {
  display: inline-block;
  height: 26px;
}

.apos-admin-bar__sub /deep/ .apos-context-menu__btn,
.apos-admin-bar__btn,
.apos-admin-bar__btn.apos-button {
  @include type-base;
  border-radius: 0;
  height: $menu-row-height;

  &:hover,
  &:focus {
    box-shadow: none;
    outline-width: 0;
    background-color: var(--a-base-9);
    color: currentColor;
    text-decoration: none;
  }
}
.apos-admin-bar__item {
  display: inline-flex;
  align-items: center;
}

.apos-admin-bar__sub /deep/ .apos-context-menu__btn {
  border-radius: 0;
}

.apos-admin-bar__logo {
  margin-right: $menu-h-space;
}

.apos-admin-bar__logo,
.apos-admin-bar /deep/ .apos-context-menu__btn,
.apos-admin-bar__btn {
  padding-top: $menu-v-pad;
  padding-bottom: $menu-v-pad;
}

.apos-admin-bar__sub /deep/ .apos-button,
.apos-admin-bar__btn,
.apos-admin-bar__row /deep/ .apos-admin-bar__btn {
  @include apos-button-reset();
  position: relative;
  display: inline-flex;
  align-items: center;
  margin: 0;
  padding-right: $menu-h-space;
  padding-left: $menu-h-space;
  border: 0;
  color: var(--a-text-primary);
  text-decoration: none;
  cursor: pointer;
}

.apos-admin-bar__sub /deep/ .apos-context-menu__popup {
  top: calc(100% + 5px);
}

.apos-admin-bar__btn {
  .apos-admin-bar__row--utils & {
    padding-left: $admin-bar-h-pad;
    padding-right: $admin-bar-h-pad;
    border-right: $admin-bar-border;

    &:hover,
    &:focus {
      border-width: 1px;
    }
  }

  .apos-admin-bar__dropdown-items & {
    padding: 25px;
  }
}

.apos-admin-bar__dropdown-items {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--a-base-10);
}

.apos-admin-bar__create {
  margin-left: 10px;
  // Adjust button padding and svg size to have a large plus icon while keeping
  // the button size the same.
  /deep/ .apos-context-menu__btn {
    padding: 2px;
    border-width: 0;
  }

  /deep/ .apos-context-menu__popup {
    top: calc(100% + 13px);
  }

  /deep/ .apos-button__icon svg {
    width: 19px;
    height: 19px;
  }
}

.apos-admin-bar__user {
  margin-left: auto;
}

/deep/ .apos-context-menu__pane {
  min-width: 150px;
}
</style>
