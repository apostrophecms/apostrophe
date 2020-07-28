<template>
  <nav class="apos-admin-bar">
    <AposLogo class="apos-admin-bar__logo" />
    <ul class="apos-admin-bar__items">
      <li
        v-for="(item, index) in menuItems" :key="item.name"
        class="apos-admin-bar__item"
      >
        <component
          v-if="item.options" :is="item.options.href ? 'a' : 'button'"
          class="apos-admin-bar__btn" :href="item.options.href"
          v-on="item.options.href ? {} : { click: () => emitEvent(item.name) }"
        >
          {{ item.label }}
        </component>
        <AposContextMenu
          v-else-if="item.items" class="apos-admin-bar__sub"
          :menu="item.items" :button="{
            label: item.label
          }"
          :tip-alignment="index > 1 ? 'right' : 'left'"
        />
      </li>
      <li class="apos-admin-bar__item" v-if="createMenu.length > 0">
        <AposContextMenu
          class="apos-admin-bar__create"
          :menu="createMenu" :button="{
            label: 'New item',
            iconOnly: true,
            icon: 'plus-icon',
            type: 'primary'
          }"
          tip-alignment="right"
        />
      </li>
    </ul>
    <TheAposAdminBarUser
      class="apos-admin-bar__user"
      :user="user" :avatar-url="userAvatar"
    />
  </nav>
</template>

<script>

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
  emits: ['admin-menu-click'],
  data() {
    return {
      menuItems: [],
      createMenu: [],
      user: {}
    };
  },
  computed: {
    userAvatar() {
      // TODO: get the user avatar via an async API call
      // when this.user._id is truthy
      return require('./userData').userAvatar;
    }
  },
  mounted() {
    this.menuItems = [...this.items];
    // TODO: This will need to be an async call to get pieces as well as the
    // new page route.
    this.createMenu = [
      {
        label: 'Sandwich',
        name: 'sandwich-artists',
        action: 'sandwich-piece'
      },
      {
        label: 'Tree',
        name: 'trees',
        action: 'trees-piece'
      }
    ];

    this.user = require('./userData').user;
  },
  methods: {
    emitEvent: function (name) {
      apos.bus.$emit('admin-menu-click', name);
    }
  }
};
</script>

<style lang="scss" scoped>
$menu-height: 68px;
$menu-v-pad: 18px;
$menu-item-height: $menu-height - (2 * $menu-v-pad);
$menu-h-space: 16px;
$menu-v-space: 25px;

body {
  margin-top: $menu-height;
}

.apos-admin-bar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  display: flex;
  align-items: center;
  height: $menu-height;
  padding: 0 30px 0 16px;
  border-bottom: 1px solid var(--a-base-9);
  background: var(--a-background-primary);
  font-size: map-get($font-sizes, menu-label);
}

.apos-admin-bar__items {
  display: flex;
  margin: 0;
  padding: 0;
}

.apos-admin-bar__logo {
  display: inline-block;
  height: $menu-item-height;
}

.apos-admin-bar__create /deep/ .apos-context-menu__btn,
.apos-admin-bar__sub /deep/ .apos-context-menu__btn,
.apos-admin-bar__btn {
  &:hover,
  &:focus {
    transform: none;
  }
}

.apos-admin-bar__sub /deep/ .apos-context-menu__btn,
.apos-admin-bar__btn {
  height: $menu-height;

  &:hover,
  &:focus {
    box-shadow: none;
    outline-width: 0;
    background-color: var(--a-base-8);
  }
}
.apos-admin-bar__item {
  display: inline-flex;
  align-items: center;
}

.apos-admin-bar__sub /deep/ .apos-context-menu__btn {
  padding-left: 20px;
  padding-right: 20px;
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
.apos-admin-bar__btn {
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

.apos-admin-bar__dropdown-items .apos-admin-bar__btn {
  padding: 25px;
}

.apos-admin-bar__dropdown-items {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--a-base-10);
}

.apos-admin-bar__create {
  margin-left: 20px;
  // Adjust button padding and svg size to have a large plus icon while keeping
  // the button size the same.
  /deep/ .apos-context-menu__btn {
    padding: 5px;
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
