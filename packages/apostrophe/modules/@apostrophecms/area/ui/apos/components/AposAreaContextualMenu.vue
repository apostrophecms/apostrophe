<template>
  <div
    class="apos-area-menu"
    :class="{'apos-is-focused': groupIsFocused}"
  >
    <AposContextMenu
      v-bind="extendedContextMenuOptions"
      ref="contextMenu"
      :disabled="isDisabled"
      :button="buttonOptions"
      :popover-modifiers="inContext ? ['z-index-in-context'] : []"
      :menu-id="menuId"
      @open="buttonOpen = true"
      @close="buttonOpen = false"
    >
      <ul class="apos-area-menu__wrapper">
        <li
          v-for="(item, itemIndex) in myMenu"
          :key="item.type ? `${item.type}_${item.label}` : item.label"
          :ref="`item-${itemIndex}`"
          class="apos-area-menu__item"
          :class="{'apos-has-group': item.items}"
        >
          <dl
            v-if="item.items"
            class="apos-area-menu__group"
          >
            <dt>
              <button
                v-if="item.items"
                :id="`${menuId}-trigger-${itemIndex}`"
                ref="groupButton"
                :for="item.label"
                class="apos-area-menu__group-label"
                tabindex="0"
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
              >
                <span>{{ item.label }}</span>
                <chevron-up-icon
                  class="apos-area-menu__group-chevron"
                  :class="{'apos-is-active': itemIndex === active}"
                  :size="13"
                />
              </button>
            </dt>
            <dd
              class="apos-area-menu__group-list"
              role="region"
            >
              <ul
                :id="`${menuId}-group-${itemIndex}`"
                class="apos-area-menu__items apos-area-menu__items--accordion"
                :class="{'apos-is-active': active === itemIndex}"
                :aria-labelledby="`${menuId}-trigger-${itemIndex}`"
                :aria-expanded="active === itemIndex ? 'true' : 'false'"
              >
                <li
                  v-for="(child, childIndex) in item.items"
                  :key="child.name"
                  :ref="`child-${index}-${childIndex}`"
                  class="apos-area-menu__item"
                >
                  <AposAreaMenuItem
                    :item="child"
                    :tabbable="itemIndex === active"
                    @click="action(child)"
                    @up="switchItem(`child-${itemIndex}-${childIndex - 1}`, -1)"
                    @down="switchItem(`child-${itemIndex}-${childIndex + 1}`, 1)"
                  />
                </li>
              </ul>
            </dd>
          </dl>
          <AposAreaMenuItem
            v-else
            :item="item"
            @click="action(item)"
            @up="switchItem(`item-${itemIndex - 1}`, -1)"
            @down="switchItem(`item-${itemIndex + 1}`, 1)"
          />
        </li>
      </ul>
    </AposContextMenu>
  </div>
</template>

<script>
import { createId } from '@paralleldrive/cuid2';
import filterCreateWidgetOperations from '../lib/filter-create-widget-operations.js';

export default {
  name: 'AposAreaContextualMenu',
  props: {
    buttonOptions: {
      type: Object,
      required: true
    },
    contextMenuOptions: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      default: 0
    },
    options: {
      type: Object,
      required: true
    },
    maxReached: {
      type: Boolean
    },
    disabled: {
      type: Boolean,
      default: false
    },
    // NOTE: Left for backwards compatibility.
    // Should use options now instead.
    widgetOptions: {
      type: Object,
      default: function() {
        return {};
      }
    },
    fieldId: {
      type: String,
      required: true
    },
    menuId: {
      type: String,
      default() {
        return `areaMenu-${createId()}`;
      }
    },
    open: {
      type: Boolean
    }
  },
  emits: [ 'add' ],
  data() {
    return {
      active: 0,
      groupIsFocused: false,
      inContext: true,
      buttonOpen: false
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.area;
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
      // Ensures we take a fresh look at the clipboard when toggled open again.
      // We can't just use || because shortcut evaluation will prevent the second
      // reactive property from being evaluated.
      let openVia = 0;
      if (this.open) {
        openVia++;
      }
      if (this.buttonOpen) {
        openVia++;
      }
      if (openVia === 0) {
        // If the menu is not open, we don't need to compute it right now
        return [];
      }
      const menu = [ ...this.contextMenuOptions.menu ];
      const createWidgetOperations = filterCreateWidgetOperations(
        this.moduleOptions,
        this.options
      );
      for (const createWidgetOperation of createWidgetOperations) {
        menu.unshift({
          type: 'operation',
          ...createWidgetOperation
        });
      }
      const clipboard = apos.area.widgetClipboard.get();
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
    }
  },
  mounted() {
    // if this area is not in-context then it is assumed in a schema's modal and
    // we need to bump the z-index of menus above them
    this.inContext = !apos.util.closest(this.$el, '[data-apos-schema-area]');
  },
  methods: {
    async action(item) {
      if (item.type === 'operation') {
        const props = {
          ...item.props,
          options: this.options,
          fieldId: this.fieldId
        };
        this.$refs.contextMenu.hide();
        const widget = await apos.modal.execute(item.modal, props);
        if (widget) {
          // Insert the widget at the appropriate insertion point, like we normally would
          this.$emit('add', {
            widget,
            index: this.index
          });
        }
        return;
      }
      // Potential TODO: If we find ourselves manually flipping these bits in
      // other AposContextMenu overrides we should consider refactoring
      // contextmenus to be able to self close when any click takes place within
      // their el as it is often the logical experience (not always, see tag
      // menus and filters)
      this.$refs.contextMenu.hide();
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

.apos-area-menu.apos-is-focused :deep(.apos-context-menu__inner) {
  border: 1px solid var(--a-base-4);
}

.apos-area-menu.apos-is-focused :deep(.apos-context-menu__tip-outline) {
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

    & {
      box-sizing: border-box;
      width: 100%;
      padding: 5px 20px;
      color: var(--a-base-1);
    }

  &:hover,
  &:focus {
    &:deep(.apos-area-menu__item-icon) {
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

  & {
    display: flex;
    box-sizing: border-box;
    justify-content: space-between;
    width: 100%;
    padding: 10px 20px;
  }

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

  & {
    transform: rotate(90deg);
  }
}

.apos-area-menu__group-chevron.apos-is-active {
  transform: rotate(180deg);
}

.apos-area-menu__group {
  margin: 10px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--a-base-8);
}

.apos-area-menu__item:last-child.apos-has-group .apos-area-menu__group {
  margin-bottom: 0;
  border-bottom: none;
}

.apos-area-menu__items--accordion {
  @include apos-transition($duration:0.3s);

  & {
    overflow: hidden;
    max-height: 0;
  }
}

.apos-area-menu__items--accordion.apos-is-active {
  transition-delay: 250ms;
  max-height: 20rem;
}

</style>
