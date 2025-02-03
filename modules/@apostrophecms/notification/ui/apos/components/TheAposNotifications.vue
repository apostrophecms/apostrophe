<template>
  <transition-group
    name="list"
    tag="div"
    class="apos-notifications"
    :class="themeClass"
  >
    <AposNotification
      v-for="notification in store.notifications"
      :key="notification._id"
      :notification="notification"
      @close="store.dismiss"
    />
  </transition-group>
</template>

<script>
import { useAposTheme } from 'Modules/@apostrophecms/ui/composables/AposTheme.js';
import { useNotificationStore } from 'Modules/@apostrophecms/ui/stores/notification.js';

export default {
  name: 'TheAposNotifications',
  setup() {
    const { themeClass } = useAposTheme();
    const store = useNotificationStore();

    return {
      themeClass,
      store
    };
  }
};
</script>

<style lang="scss" scoped>
  .apos-notifications {
    z-index: $z-index-notifications;
    position: fixed;
    bottom: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    pointer-events: none;
  }

  .list-enter-active,
  .list-leave-active {
    @include apos-transition();
  }

  .list-enter,
  .list-leave-to {
    opacity: 0;
    transform: translateY(5px);
  }

</style>
