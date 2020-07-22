<template>
  <AposContextMenu
    class="apos-admin-user" tip-alignment="right"
    :button="button" :menu="menu"
  >
    <template #prebutton>
      <AposAvatar
        class="apos-admin-user__avatar"
        :src="avatarUrl"
        size="32px" alt=""
      />
    </template>
  </AposContextMenu>
</template>

<script>
import AposContextMenu from '../contextMenu/AposContextMenu.vue';
import AposHelpers from '../../mixins/AposHelpersMixin';
import AposAvatar from '../../components/avatar/AposAvatar';

export default {
  components: {
    AposContextMenu,
    AposAvatar
  },
  mixins: [AposHelpers],
  props: {
    user: {
      type: Object,
      required: true
    }
  },
  emits: ['input'],
  data() {
    return {
      avatarUrl: '',
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
        modifiers: ['icon-right'],
        type: 'quiet'
      };
    }
  },
  mounted() {
    if (apos.user) {
      // Get avatar URL via an async API call.
    } else if (process.env.STORYBOOK_MODE) {
      this.avatarUrl = require('./userData').userAvatar;
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
.apos-admin-user {
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
