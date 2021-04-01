<template>
  <div class="apos-admin-bar-wrapper" :class="themeClass">
    <div class="apos-admin-bar-spacer" ref="spacer" />
    <nav class="apos-admin-bar" ref="adminBar">
      <div class="apos-admin-bar__row">
        <AposLogoPadless class="apos-admin-bar__logo" />
        <TheAposAdminBarMenu :items="items" />
        <TheAposAdminBarUser class="apos-admin-bar__user" />
      </div>
      <TheAposContextBar v-if="contextBarActive" />
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
  computed: {
    contextBarActive() {
      return window.apos.adminBar.contextBar;
    }
  },
  async mounted() {
    window.apos.adminBar.height = this.$refs.adminBar.offsetHeight;
    this.$refs.spacer.style.height = `${this.$refs.adminBar.offsetHeight}px`;
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

/deep/ .apos-admin-bar__row {
  display: flex;
  align-items: center;
  height: 35px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--a-base-9);
}

/deep/ .apos-admin-bar__control-set--title {
  justify-content: center;
  align-items: center;
}

/deep/ .apos-admin-bar__title {
  display: inline-flex;
  align-items: center;

  &__document-title,
  &__separator {
    display: inline-flex;
    color: var(--a-text-primary);
  }

  &__document-title {
    margin-top: 1px;
  }

  &__separator {
    align-items: center;
    padding: 0 7px;
    margin-top: 1px;
  }

  &__document {
    margin-top: 3.5px;
  }

  & /deep/ .apos-indicator {
    margin-top: 1px;
  }
}

/deep/ .apos-admin-bar__title__indicator {
  margin-right: 5px;
  color: var(--a-text-primary);
}

/deep/ .apos-admin-bar__items {
  display: flex;
  margin: 0;
  padding: 0;
}

/deep/ .apos-admin-bar__logo {
  display: inline-block;
  height: 26px;
}

/deep/ .apos-admin-bar__item {
  display: inline-flex;
  align-items: center;
}

/deep/ .apos-admin-bar__sub /deep/ .apos-context-menu__btn {
  border-radius: 0;
}

/deep/ .apos-admin-bar__logo {
  margin-right: 10px;
}

/deep/ .apos-admin-bar__sub /deep/ .apos-context-menu__popup {
  top: calc(100% + 5px);
}

/deep/ .apos-admin-bar__row--utils {
  display: flex;
  align-items: center;
}

/deep/ .apos-admin-bar__control-set {
  @include type-base;
  display: flex;
  width: 100%;
  height: 100%;
}

/deep/ .apos-admin-bar__control-set--mode-and-settings {
  justify-content: flex-end;
  & /deep/ .apos-button {
    margin-left: 4px;
  }
}

/deep/ .apos-admin-bar__control-set__group {
  display: flex;
  align-items: center;
}

/deep/ .apos-admin-bar__dropdown-items {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--a-base-10);
}

/deep/ .apos-admin-bar__create {
  margin-left: 10px;

  /deep/ .apos-context-menu__btn {
    width: 21px;
    height: 21px;
  }

  /deep/ .apos-context-menu__btn .apos-button {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
  }

  /deep/ .apos-context-menu__popup {
    top: calc(100% + 13px);
  }
}

/deep/ .apos-admin-bar__user {
  margin-left: auto;
}

/deep/ .apos-context-menu__pane {
  min-width: 150px;
}

/deep/ .apos-admin-bar__status {
  @include type-help;
  position: relative;
  margin-left: 7.5px;
  opacity: 1;
  color: var(--a-base-2);
  transition: opacity 150ms;
  &.is-hidden {
    opacity: 0;
  }
  .is-success {
    color: var(--a-success);
  }

  .is-warning {
    color: var(--a-warning);
  }
}

/deep/ .apos-admin-bar__status__inner {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  white-space: nowrap;
}

/deep/ .apos-admin-bar__status__icon {
  margin-right: 7.5px;
  width: 18px;
  height: 18px;
}

/deep/ .apos-admin-bar__status__label {
  opacity: 1;
  transition: opacity 200ms ease;
  &.is-hidden {
    opacity: 0;
  }
}

/deep/ .flip-enter { // to the ground
  transform: translateY(-20%);
  opacity: 0;
}
/deep/ .flip-leave { // in the frame
  transform: translateY(0);
  opacity: 1;
}
/deep/ .flip-enter-to { // from the ground
  transform: translateY(0);
  opacity: 1;
}
/deep/ .flip-leave-to { // to the sky
  transform: translateY(20%);
  opacity: 0;
}

/deep/ .flip-enter-active, /deep/ .flip-leave-active {
  transition: all 150ms;
  &.apos-admin-bar__control-set__group {
    position: absolute;
  }
}

</style>
