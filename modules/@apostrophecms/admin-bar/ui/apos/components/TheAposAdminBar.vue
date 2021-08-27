<template>
  <div class="apos-admin-bar-wrapper" :class="themeClass">
    <div class="apos-admin-bar-spacer" ref="spacer" />
    <nav class="apos-admin-bar" ref="adminBar">
      <div class="apos-admin-bar__row">
        <AposLogoPadless class="apos-admin-bar__logo" />
        <TheAposAdminBarMenu :items="items" />
        <TheAposAdminBarLocale v-if="hasLocales()" />
        <TheAposAdminBarUser class="apos-admin-bar__user" />
      </div>
      <TheAposContextBar @mounted="setSpacer" />
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
      default: function () {
        return [];
      }
    }
  },
  async mounted() {
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

::v-deep .apos-admin-bar__row {
  display: flex;
  align-items: center;
  height: 35px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--a-base-9);
}

.apos-admin-bar__logo {
  display: inline-block;
  height: 26px;
  margin-right: 10px;
}

::v-deep .apos-admin-bar__control-set {
  @include type-base;
  display: flex;
  width: 100%;
  height: 100%;
}

.apos-admin-bar__user {
  margin-left: auto;
}

::v-deep .apos-context-menu__pane {
  min-width: 150px;
}
::v-deep .flip-enter { // to the ground
  transform: translateY(-20%);
  opacity: 0;
}
::v-deep .flip-leave { // in the frame
  transform: translateY(0);
  opacity: 1;
}
::v-deep .flip-enter-to { // from the ground
  transform: translateY(0);
  opacity: 1;
}
::v-deep .flip-leave-to { // to the sky
  transform: translateY(20%);
  opacity: 0;
}

::v-deep .flip-enter-active, ::v-deep .flip-leave-active {
  transition: all 150ms;
  &.apos-admin-bar__control-set__group {
    position: absolute;
  }
}

// make space for a widget's breadcrumbs that are flush with the admin bar
.apos-admin-bar-spacer {
  margin-bottom: 25px;
}

</style>
