<template>
  <div class="apos-area-menu" :class="{'apos-is-focused': groupIsFocused}">
    <AposContextMenu
      :disabled="isDisabled"
      :button="buttonOptions"
      v-bind="extendedContextMenuOptions"
      @open="menuOpen"
      @close="menuClose"
      ref="contextMenu"
      :popover-modifiers="inContext ? ['z-index-in-context'] : []"
    >
      <ul class="apos-area-menu__wrapper">
        <li
          class="apos-area-menu__item"
          v-for="(item, itemIndex) in myMenu"
          :key="item.type ? `${item.type}_${item.label}` : item.label"
          :class="{'apos-has-group': item.items}"
          :ref="`item-${itemIndex}`"
        >
          <dl v-if="item.items" class="apos-area-menu__group">
            <dt>
              <button
                :for="item.label" class="apos-area-menu__group-label"
                v-if="item.items" tabindex="0"
                :id="`${menuId}-trigger-${itemIndex}`"
                :aria-controls="`${menuId}-group-${itemIndex}`"
                @focus="groupFocused"
                @blur="groupBlurred"
                @click="toggleGroup(itemIndex)"
                @keydown.prevent.space="toggleGroup(itemIndex)"
                @keydown.prevent.enter="toggleGroup(itemIndex)"
                @keydown.prevent.arrow-down="switchGroup(itemIndex, 1)"
                @keydown.prevent.arrow-up="switchGroup(itemIndex, -1)"
                @keydown.prevent.home="switchGroup(itemIndex, 0)"
                @keydown.prevent.end="switchGroup(itemIndex, null)"
                ref="groupButton"
              >
                <span>{{ item.label }}</span>
                <chevron-up-icon
                  class="apos-area-menu__group-chevron"
                  :class="{'apos-is-active': itemIndex === active}" :size="13"
                />
              </button>
            </dt>
            <dd class="apos-area-menu__group-list" role="region">
              <ul
                class="apos-area-menu__items apos-area-menu__items--accordion"
                :class="{'apos-is-active': active === itemIndex}"
                :id="`${menuId}-group-${itemIndex}`"
                :aria-labelledby="`${menuId}-trigger-${itemIndex}`"
                :aria-expanded="active === itemIndex ? 'true' : 'false'"
              >
                <li
                  class="apos-area-menu__item"
                  v-for="(child, childIndex) in item.items"
                  :key="child.name"
                  :ref="`child-${index}-${childIndex}`"
                >
                  <AposAreaMenuItem
                    @click="add(child)"
                    :item="child"
                    :tabbable="itemIndex === active"
                    @up="switchItem(`child-${itemIndex}-${childIndex - 1}`, -1)"
                    @down="switchItem(`child-${itemIndex}-${childIndex + 1}`, 1)"
                  />
                </li>
              </ul>
            </dd>
          </dl>
          <AposAreaMenuItem
            v-else
            @click="add(item)"
            :item="item"
            @up="switchItem(`item-${itemIndex - 1}`, -1)"
            @down="switchItem(`item-${itemIndex + 1}`, 1)"
          />
        </li>
      </ul>
    </AposContextMenu>
  </div>
</template>

<script>

import cuid from 'cuid';

export default {
  props: {
    empty: {
      type: Boolean,
      default: false
    },
    contextMenuOptions: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      default: 0
    },
    widgetOptions: {
      type: Object,
      required: true
    },
    maxReached: {
      type: Boolean
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'menu-close', 'menu-open', 'add' ],
  data() {
    return {
      active: 0,
      groupIsFocused: false,
      inContext: true
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.area;
    },
    buttonOptions() {
      return {
        label: 'apostrophe:addContent',
        iconOnly: this.empty === false,
        icon: 'plus-icon',
        type: 'primary',
        modifiers: this.empty ? [] : [ 'round', 'tiny' ],
        iconSize: this.empty ? 20 : 11
      };
    },
    isDisabled() {
      let flag = this.disabled;
      if (this.maxReached) {
        flag = true;
      }
      return flag;
    },
    extendedContextMenuOptions() {
      const modifiers = [ 'unpadded' ];
      if (!this.groupedMenus) {
        modifiers.push('tb-padded');
      }
      return {
        menuPlacement: 'bottom',
        menuOffset: 15,
        ...this.contextMenuOptions,
        modifiers
      };
    },
    groupedMenus() {
      let flag = false;
      this.contextMenuOptions.menu.forEach((e) => {
        if (e.items) {
          flag = true;
        }
      });
      return flag;
    },
    myMenu() {
      const clipboard = apos.area.widgetClipboard.get();
      const menu = [ ...this.contextMenuOptions.menu ];
      if (clipboard) {
        const widget = clipboard;
        const matchingChoice = menu.find(option => option.name === widget.type);
        if (matchingChoice) {
          menu.unshift({
            type: 'clipboard',
            ...matchingChoice,
            label: {
              key: 'apostrophe:pasteWidget',
              widget: this.$t(matchingChoice.label)
            },
            clipboard: widget
          });
        }
      }
      if (this.groupedMenus) {
        return this.composeGroups(menu);
      } else {
        return menu;
      }
    },
    menuId() {
      return `areaMenu-${cuid()}`;
    }
  },
  mounted() {
    // if this area is not in-context then it is assumed in a schema's modal and we need to bump
    // the z-index of menus above them
    this.inContext = !apos.util.closest(this.$el, '[data-apos-schema-area]');
  },
  methods: {
    menuClose(e) {
      this.$emit('menu-close', e);
    },
    menuOpen(e) {
      this.$emit('menu-open', e);
    },
    async add(item) {
      // Potential TODO: If we find ourselves manually flipping these bits in other AposContextMenu overrides
      // we should consider refactoring contextmenus to be able to self close when any click takes place within their el
      // as it is often the logical experience (not always, see tag menus and filters)
      this.$refs.contextMenu.isOpen = false;
      this.$emit('add', {
        ...item,
        index: this.index
      });
    },
    groupFocused() {
      this.groupIsFocused = true;
    },
    groupBlurred() {
      this.groupIsFocused = false;
    },
    composeGroups(menu) {
      const ungrouped = {
        label: 'apostrophe:ungroupedWidgets',
        items: []
      };
      const myMenu = [];

      menu.forEach((item) => {
        if (!item.items) {
          ungrouped.items.push(item);
        } else {
          myMenu.push(item);
        }
      });

      if (ungrouped.items.length) {
        myMenu.push(ungrouped);
      }
      return myMenu;
    },

    toggleGroup(index) {
      if (this.active !== index) {
        this.active = index;
      } else {
        this.active = null;
      }
    },

    switchGroup(index, dir) {
      let target;

      if (dir > 0) {
        target = index < this.$refs.groupButton.length - 1 ? index + 1 : 0;
      }

      if (dir < 0) {
        target = index === 0 ? this.$refs.groupButton.length - 1 : index - 1;
      }

      if (dir === 0) {
        target = 0;
      }

      if (!dir) {
        target = this.$refs.groupButton.length - 1;
      }

      this.$nextTick(() => {
        this.$refs.groupButton[target].focus();
      });
    },

    switchItem(name, dir) {
      if (this.$refs[name]) {
        this.$refs[name][0].querySelector('button').focus();
      }
    }
  }
};
</script>

<style lang="scss" scoped>

.apos-area-menu.apos-is-focused ::v-deep .apos-context-menu__inner {
  border: 1px solid var(--a-base-4);
}

.apos-area-menu.apos-is-focused ::v-deep .apos-context-menu__tip-outline {
  stroke: var(--a-base-4);
}

.apos-area-menu__wrapper,
.apos-area-menu__items,
.apos-area-menu__group-list {
  @include apos-list-reset();
}

.apos-area-menu__wrapper {
  min-width: 250px;
}

.apos-area-menu__button {
  @include apos-button-reset();
  @include type-base;
  box-sizing: border-box;
  width: 100%;
  padding: 5px 20px;
  color: var(--a-base-1);

  &:hover,
  &:focus {
    & ::v-deep .apos-area-menu__item-icon {
      color: var(--a-primary);
    }
  }

  &:hover {
    cursor: pointer;
    color: var(--a-text-primary);
  }

  &:focus {
    outline: none;
    color: var(--a-text-primary);
  }

  &:active {
    color: var(--a-base-1);
  }
}

.apos-area-menu__accordion-trigger {
  z-index: $z-index-under;
  opacity: 0;
  position: absolute;
}

.apos-area-menu__group-label {
  @include apos-button-reset();
  box-sizing: border-box;
  display: flex;
  width: 100%;
  justify-content: space-between;
  padding: 10px 20px;
  &:hover {
    cursor: pointer;
  }

  &:focus {
    background-color: var(--a-base-10);
    outline: 1px solid var(--a-base-4);
  }
}

.apos-area-menu__group-chevron {
  @include apos-transition();
  transform: rotate(90deg);
}

.apos-area-menu__group-chevron.apos-is-active {
  transform: rotate(180deg);
}

.apos-area-menu__group {
  border-bottom: 1px solid var(--a-base-8);
  padding-bottom: 10px;
  margin: 10px 0;
}
.apos-area-menu__item:last-child.apos-has-group .apos-area-menu__group {
  border-bottom: none;
  margin-bottom: 0;
}

.apos-area-menu__items--accordion {
  overflow: hidden;
  max-height: 0;
  @include apos-transition($duration:0.3s);
}

.apos-area-menu__items--accordion.apos-is-active {
  transition-delay: 0.25s;
  max-height: 20rem;
}

</style>
