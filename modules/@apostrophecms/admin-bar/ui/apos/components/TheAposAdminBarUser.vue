<template>
  <AposContextMenu
    class="apos-admin-user"
    :button="button"
    :menu="items"
    :center-on-icon="true"
    menu-placement="bottom-end"
    @item-clicked="emitEvent"
  >
    <template #prebutton>
      <AposAvatar
        class="apos-admin-user__avatar"
        :user="user"
      />
    </template>
  </AposContextMenu>
</template>

<script>

export default {
  name: 'TheAposAdminBarUser',
  props: {
    items: {
      type: Array,
      required: true
    }
  },
  computed: {
    button() {
      return {
        label: {
          key: this.user.title || '',
          localize: false
        },
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
    emitEvent(item) {
      apos.bus.$emit('admin-menu-click', item.action);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-admin-user.apos-context-menu {
  display: inline-flex;
  align-items: center;

  :deep(.apos-button) {
    @include type-base;

    & {
      color: var(--a-text-primary);
    }
  }

  :deep(.apos-context-menu__popup) {
    right: 0;
    transform: translateX(10px);
  }
}

.apos-admin-user__avatar {
  margin-right: 8px;
}
</style>
