<template>
  <div
    data-apos-test="adminBar"
    class="apos-admin-bar-wrapper"
    :class="themeClass"
  >
    <div ref="spacer" class="apos-admin-bar-spacer" />
    <nav
      ref="adminBar"
      class="apos-admin-bar"
      role="menubar"
      aria-label="Apostrophe Admin Bar"
    >
      <div class="apos-admin-bar__row">
        <AposLogoPadless class="apos-admin-bar__logo" />
        <TheAposAdminBarMenu :items="menuItems" />
        <TheAposAdminBarLocale v-if="hasLocales()" />
        <TheAposAdminBarUser
          data-apos-test="authenticatedUserMenuTrigger"
          class="apos-admin-bar__user"
          :items="userItems"
        />
      </div>
      <TheAposContextBar @visibility-changed="setSpacer" />
      <component
        v-bind="bar.props || {}"
        :is="bar.componentName"
        v-for="bar in bars"
        :key="bar.id"
      />
    </nav>
  </div>
</template>

<script>
import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin';

export default {
  name: 'TheAposAdminBar',
  mixins: [ AposThemeMixin ],
  props: {
    items: {
      type: Array,
      required: true
    }
  },
  computed: {
    menuItems() {
      return this.items.filter(item => !item.options?.user);
    },
    userItems() {
      return this.items.filter(item => item.options?.user);
    },
    moduleOptions() {
      return window.apos.adminBar;
    },
    bars() {
      return this.moduleOptions.bars;
    }
  },
  mounted() {
    this.setSpacer();
  },
  methods: {
    setSpacer() {
      window.apos.adminBar.height = this.$refs.adminBar.offsetHeight;
      this.$refs.spacer.style.height = `${this.$refs.adminBar.offsetHeight}px`;
      apos.bus.$emit('admin-menu-height-changed');
    },
    hasLocales() {
      return Object.keys(window.apos.i18n.locales).length > 1;
    }
  }
};
</script>

<style lang="scss" scoped>

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

:deep(.apos-admin-bar__row) {
  display: flex;
  align-items: center;
  height: 55px;
  padding: 0 20px;
  line-height: var(--a-line-base);
  border-bottom: 1px solid var(--a-base-9);
}

.apos-admin-bar__logo {
  display: inline-block;
  height: 26px;
  margin-right: 10px;
}

:deep(.apos-admin-bar__control-set) {
  @include type-base;

  & {
    display: flex;
    width: 100%;
    height: 100%;
  }
}

.apos-admin-bar__user {
  margin-left: auto;
}

:deep(.flip-enter) { // to the ground
  transform: translateY(-20%);
  opacity: 0;
}

:deep(.flip-leave) { // in the frame
  transform: translateY(0);
  opacity: 1;
}

:deep(.flip-enter-to) { // from the ground
  transform: translateY(0);
  opacity: 1;
}

:deep(.flip-leave-to) { // to the sky
  transform: translateY(20%);
  opacity: 0;
}

:deep(.flip-enter-active), :deep(.flip-leave-active) {
  transition: all 200ms;

  &.apos-admin-bar__control-set__group {
    position: absolute;
  }
}

</style>
