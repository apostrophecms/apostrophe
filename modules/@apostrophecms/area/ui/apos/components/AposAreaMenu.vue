<template>
  <div class="apos-area-menu" :class="{'apos-area-menu--grouped': groupedMenus, 'is-focused': groupIsFocused}">
    <AposContextMenu tip-alignment="center" :modifiers="['unpadded']">
      <ul class="apos-area-menu__wrapper">
        <li
          class="apos-area-menu__item"
          v-for="(item, index) in myMenu" :key="item.label"
          :class="{'has-group': item.items}"
          :ref="`item-${index}`"
        >
          <dl v-if="item.items" class="apos-area-menu__group">
            <dt>
              <button
                :for="item.label" class="apos-area-menu__group-label"
                v-if="item.items" tabindex="0"
                :id="`${menuId}-trigger-${index}`"
                :aria-controls="`${menuId}-group-${index}`"
                @focus="groupFocused"
                @blur="groupBlurred"
                @click="toggleGroup(index)"
                @keydown.prevent.space="toggleGroup(index)"
                @keydown.prevent.enter="toggleGroup(index)"
                @keydown.prevent.arrow-down="switchGroup(index, 1)"
                @keydown.prevent.arrow-up="switchGroup(index, -1)"
                @keydown.prevent.home="switchGroup(index, 0)"
                @keydown.prevent.end="switchGroup(index, null)"
                ref="groupButton"
              >
                <span>{{ item.label }}</span>
                <chevron-up-icon
                  class="apos-area-menu__group-chevron"
                  :class="{'is-active': index === active}" :size="13"
                />
              </button>
            </dt>
            <dd class="apos-area-menu__group-list" role="region">
              <ul
                class="apos-area-menu__items apos-area-menu__items--accordion"
                :class="{'is-active': active === index}"
                :id="`${menuId}-group-${index}`"
                :aria-labelledby="`${menuId}-trigger-${index}`"
                :aria-expanded="active === index ? 'true' : 'false'"
              >
                <li
                  class="apos-area-menu__item"
                  v-for="(child, childIndex) in item.items"
                  :key="child.action"
                  :ref="`child-${index}-${childIndex}`"
                >
                  <AposAreaMenuItem
                    @click="clicked(child)"
                    :item="child"
                    :tabbable="index === active"
                    @up="switchItem(`child-${index}-${childIndex - 1}`, -1)"
                    @down="switchItem(`child-${index}-${childIndex + 1}`, 1)"
                  />
                </li>
              </ul>
            </dd>
          </dl>
          <AposAreaMenuItem
            v-else
            @click="clicked(item)"
            :item="item"
            @up="switchItem(`item-${index - 1}`, -1)"
            @down="switchItem(`item-${index + 1}`, 1)"
          />
        </li>
      </ul>
    </AposContextMenu>
  </div>
</template>

<script>

export default {
  props: {
    menu: {
      type: Array,
      required: true
    }
  },
  emits: ['click'],
  data() {
    return {
      active: 0,
      groupIsFocused: false
    };
  },
  computed: {
    groupedMenus() {
      let flag = false;
      this.menu.forEach((e) => {
        if (e.items) {
          flag = true;
        }
      });
      return flag;
    },
    myMenu() {
      if (this.groupedMenus) {
        return this.composeGroups();
      } else {
        return this.menu;
      }
    },
    menuId() {
      return `areaMenu-${(Math.floor(Math.random() * Math.floor(10000)))}`;
    }
  },
  methods: {
    groupFocused() {
      this.groupIsFocused = true;
    },
    groupBlurred() {
      this.groupIsFocused = false;
    },
    clicked(item) {
      this.$emit('click', item.action);
    },
    composeGroups() {
      const ungrouped = {
        label: 'Ungrouped Widgets',
        items: []
      };
      const myMenu = [];

      this.menu.forEach((item) => {
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
.apos-area-menu {
  font-size: map-get($font-sizes, default);
}

.apos-area-menu.is-focused /deep/ .apos-context-menu__inner {
  border: 1px solid var(--a-base-4);
}

.apos-area-menu.is-focused /deep/ .apos-context-menu__tip-outline {
  stroke: var(--a-base-4);
}

.apos-area-menu:not(.apos-area-menu--grouped) .apos-area-menu__wrapper {
  padding-top: 20px;
  padding-bottom: 20px;
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
  display: flex;
  width: 100%;
  padding: 5px 20px;
  align-items: center;
  color: var(--a-base-1);

  &:hover,
  &:focus {
    & /deep/ .apos-area-menu__item-icon {
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

.apos-area-menu__group-chevron.is-active {
  transform: rotate(180deg);
}

.apos-area-menu__group {
  border-bottom: 1px solid var(--a-base-8);
  padding-bottom: 10px;
  margin: 10px 0;
}
.apos-area-menu__item:last-child.has-group .apos-area-menu__group {
  border-bottom: none;
  margin-bottom: 0;
}

.apos-area-menu__items--accordion {
  overflow: hidden;
  max-height: 0;
  @include apos-transition($duration:0.3s);
}

.apos-area-menu__items--accordion.is-active {
  transition-delay: 0.25s;
  max-height: 20rem;
}

</style>
