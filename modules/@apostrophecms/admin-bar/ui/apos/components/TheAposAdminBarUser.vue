<template>
  <AposContextMenu
    class="apos-admin-user"
    :button="button"
    :menu="menu"
    menu-placement="bottom-start"
    :menu-offset="2"
  >
    <template #prebutton>
      <AposAvatar
        v-if="avatarUrl"
        class="apos-admin-user__avatar"
        :src="avatarUrl"
        size="32px" alt=""
      />
    </template>
  </AposContextMenu>
</template>

<script>
import AposHelpers from 'Modules/@apostrophecms/ui/mixins/AposHelpersMixin';

export default {
  mixins: [ AposHelpers ],
  props: {
    user: {
      type: Object,
      required: true
    },
    avatarUrl: {
      type: String,
      default: ''
    }
  },
  emits: [ 'input' ],
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
          actions: 'user-logout'
        }
      ]
    };
  },
  computed: {
    button() {
      return {
        label: this.user.label || '',
        icon: 'chevron-down-icon',
        modifiers: [ 'icon-right', 'no-motion' ],
        type: 'quiet'
      };
    }
  },
  methods: {
    input(value, name) {
      this.$emit('input', name, value);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-admin-user.apos-context-menu {
  display: inline-flex;
  align-items: center;

  /deep/ .apos-button {
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
