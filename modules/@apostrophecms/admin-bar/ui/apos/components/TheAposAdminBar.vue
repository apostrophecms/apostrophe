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
              :modifiers="['no-motion']"
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
        <div class="apos-admin-bar__context-controls">
          <AposButton
            :disabled="patchesSinceLoaded.length === 0"
            type="outline" :modifiers="['no-motion']"
            label="Undo" :tooltip="buttonLabels.undo"
            class="apos-admin-bar__context-button"
            icon="undo-icon" :icon-only="true"
            @click="undo"
          />
          <AposButton
            :disabled="undone.length === 0"
            type="outline" :modifiers="['no-motion']"
            label="Redo" :tooltip="buttonLabels.redo"
            class="apos-admin-bar__context-button"
            icon="redo-icon" :icon-only="true"
            @click="redo"
          />
        </div>
        <div class="apos-admin-bar__context-title">
          <span
            v-tooltip="'Page Title'" class="apos-admin-bar__context-title__icon"
          >
            <information-outline-icon fill-color="var(--a-primary)" :size="16" />
          </span>
          {{ moduleOptions.context.title }}
        </div>
        <div class="apos-admin-bar__context-controls">
          <AposButton
            v-if="editMode"
            class="apos-admin-bar__context-button"
            label="Preview Mode" :tooltip="{
              content: 'Preview Mode',
              offset: 0,
              placement: 'bottom'
            }"
            type="outline" :modifiers="['no-motion']"
            icon="eye-icon" :icon-only="true"
            @click="switchToPreviewMode"
          />
          <AposButton
            v-if="!editMode"
            class="apos-admin-bar__context-button"
            label="Edit" icon="pencil-icon"
            :modifiers="['no-motion']"
            @click="switchToEditMode"
          />
          <AposButton
            v-if="editMode && moduleOptions.contextId"
            class="apos-admin-bar__context-button"
            label="Page Settings" :tooltip="{
              content: 'Page Settings',
              offset: 0,
              placement: 'bottom'
            }"
            type="outline" :modifiers="['no-motion']"
            icon="cog-icon" :icon-only="true"
            @click="emitEvent({
              itemName: contextEditorName,
              props: {
                docId: moduleOptions.contextId
              }
            })"
          />
          <span class="apos-admin-bar__status">
            {{ status }}
          </span>
        </div>
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
      patchesSinceLoaded: [],
      undone: [],
      patchesSinceSave: [],
      editMode: window.sessionStorage.getItem('aposEditMode') === 'true',
      original: null,
      saving: false,
      editing: false,
      editingTimeout: null,
      retrying: false,
      saved: false,
      buttonLabels: {
        undo: 'Undo change',
        redo: 'Redo change'
      }
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
      return this.patchesSinceSave.length;
    },
    moduleOptions() {
      return window.apos.adminBar;
    },
    contextEditorName() {
      return this.moduleOptions.contextEditorName;
    },
    status() {
      if (this.retrying) {
        return 'Retrying...';
      } else if (this.saving || this.editing) {
        return 'Saving...';
      } else if (this.saved) {
        return 'Saved';
      } else {
        return '';
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

    apos.bus.$on('context-editing', async () => {
      // Accept a hint that someone is actively typing in a
      // rich text editor and a context-edited event is likely
      // coming; allows continuity of the "Saving..." indicator
      // so it doesn't flicker once a second as you type
      this.editing = true;
      if (this.editingTimeout) {
        clearTimeout(this.editingTimeout);
      }
      this.editingTimeout = setTimeout(() => {
        this.editing = false;
        // Wait slightly longer than the rich text editor does
        // before sending us a context-edited event
      }, 1100);
    });

    apos.bus.$on('context-edited', patch => {
      this.patchesSinceLoaded.push(patch);
      this.patchesSinceSave.push(patch);
      this.undone = [];
      if (!this.saving) {
        this.save();
      }
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
      this.refresh();
    }
  },
  methods: {
    beforeUnload(e) {
      if (this.patchesSinceSave.length) {
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
      // More patches could get pushed during the async call to
      // send the previous batch, so keep going until we clear
      // the queue
      while (this.patchesSinceSave.length) {
        const patchesSinceSave = this.patchesSinceSave;
        this.retrying = false;
        this.saving = true;
        this.patchesSinceSave = [];
        try {
          this.saved = false;
          await apos.http.patch(`${window.apos.doc.action}/${this.moduleOptions.contextId}`, {
            body: {
              _patches: patchesSinceSave
            }
          });
          this.retrying = false;
        } catch (e) {
          this.patchesSinceSave = [ ...patchesSinceSave, ...this.patchesSinceSave ];
          // Wait 5 seconds between attempts if errors occur
          await new Promise((resolve, reject) => {
            setTimeout(() => resolve(), 5000);
          });
          this.retrying = true;
        }
      }
      this.saving = false;
      this.saved = true;
    },
    switchToEditMode() {
      window.sessionStorage.setItem('aposEditMode', 'true');
      this.editMode = true;
      this.refresh();
    },
    switchToPreviewMode() {
      window.sessionStorage.setItem('aposEditMode', 'false');
      this.editMode = false;
      this.refresh();
    },
    async refresh() {
      let url = window.location.href;
      const qs = {
        ...apos.http.parseQuery(window.location.search),
        'apos-refresh': '1',
        ...(this.editMode ? {
          'apos-edit': '1'
        } : {})
      };
      url = url.replace(/\?.*$/, '');
      url = apos.http.addQueryToUrl(url, qs);
      const content = await apos.http.get(url, {
        qs,
        headers: {
          'Cache-Control': 'no-cache'
        },
        busy: true
      });
      const refreshable = document.querySelector('[data-apos-refreshable]');
      if (refreshable) {
        refreshable.innerHTML = content;
        if (!this.original) {
          // the first time we enter edit mode on the page, we need to
          // establish a baseline for undo/redo. Use our
          // "@ notation" PATCH feature. Sort the areas by DOM depth
          // to ensure parents patch before children
          this.original = {};
          const els = Array.from(document.querySelectorAll('[data-apos-area-newly-editable]'));
          els.sort((a, b) => {
            const da = depth(a);
            const db = depth(b);
            if (da < db) {
              return -1;
            } else if (db > da) {
              return 1;
            } else {
              return 0;
            }
          });
          for (const el of els) {
            const data = JSON.parse(el.getAttribute('data'));
            this.original[`@${data._id}`] = data;
          }
        }
      }
      apos.bus.$emit('refreshed');
    },
    async undo() {
      this.undone.push(this.patchesSinceLoaded.pop());
      await this.refreshAfterHistoryChange('The operation could not be undone.');
    },
    async redo() {
      this.patchesSinceLoaded.push(this.undone.pop());
      await this.refreshAfterHistoryChange('The operation could not be redone.');
    },
    async refreshAfterHistoryChange(errorMessage) {
      this.saving = true;
      try {
        await apos.http.patch(`${window.apos.doc.action}/${this.moduleOptions.contextId}`, {
          body: {
            _patches: [
              this.original,
              ...this.patchesSinceLoaded
            ]
          },
          busy: true
        });
        await this.refresh();
      } catch (e) {
        console.error(e);
        apos.notify(errorMessage, { type: 'error' });
      } finally {
        this.saving = false;
      }
    }
  }
};

function depth(el) {
  let depth = 0;
  while (el) {
    el = el.parentNode;
    depth++;
  }
  return depth;
}
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

.apos-admin-bar__context-title {
  @include type-base;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  flex: 1;
}

.apos-admin-bar__context-title__icon {
  display: inline-block;
  margin-right: 5px;
  line-height: 0;
}

.apos-admin-bar__context-controls {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex: 1;

  &:last-child {
    justify-content: flex-end;
  }
}

.apos-admin-bar__context-button {
  // All but the first.
  .apos-admin-bar__context-controls &:nth-child(n+2) {
    margin-left: 7.5px;
  }
}

.apos-admin-bar__items {
  display: flex;
  margin: 0;
  padding: 0;
}

.apos-admin-bar__context-controls:first-child .apos-admin-bar__context-button:first-child,
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

.apos-admin-bar__status {
  width: 100px;
  margin-left: 7.5px;
}
</style>
