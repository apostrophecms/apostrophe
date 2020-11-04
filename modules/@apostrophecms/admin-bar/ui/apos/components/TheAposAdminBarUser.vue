<template>
  <AposContextMenu
    class="apos-admin-user"
    :button="button"
    :menu="menu"
    menu-placement="bottom-end"
    :menu-offset="2"
    @item-clicked="emitEvent"
  >
    <template #prebutton>
      <AposAvatar
        class="apos-admin-user__avatar"
        :user="user"
        size="32px" alt=""
      />
    </template>
  </AposContextMenu>
</template>

<script>

export default {
  data() {
    return {
      menu: [
        {
          label: 'My Profile',
          name: 'profile',
          action: 'user-profile'
        },
        {
          label: 'Log out',
          name: 'logOut',
          action: 'user-logout'
        }
      ]
    };
  },
  computed: {
    button() {
      return {
        label: this.user.title || '',
        icon: 'chevron-down-icon',
        modifiers: [ 'icon-right', 'no-motion' ],
        type: 'quiet'
      };
    },
    user() {
      return window.apos.login.user;
    }
  },
  methods: {
    emitEvent(e) {
      if (e === 'user-profile') {
        apos.bus.$emit('admin-menu-click', {
          itemName: '@apostrophecms/user:editor',
          props: {
            docId: this.user._id
          }
        });
      } else if (e === 'user-logout') {
        apos.bus.$emit('admin-menu-click', '@apostrophecms/login-logout');
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-admin-user.apos-context-menu {
  display: inline-flex;
  align-items: center;

  /deep/ .apos-button {
    @include type-base;
    color: var(--a-text-primary);
  }

  /deep/ .apos-context-menu__popup {
    right: 0;
    transform: translatex(10px);
  }
}

.apos-admin-user__avatar {
  margin-right: 8px;
}
</style>
