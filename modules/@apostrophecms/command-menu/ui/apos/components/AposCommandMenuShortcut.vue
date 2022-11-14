<template>
  <AposModal
    :modal="modal" modal-title="apostrophe:commandMenuShortcut"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
  >
    <!--
    # @esc="confirmAndCancel" @no-modal="$emit('safe-close')"
    -->
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div
            v-for="(group, groupName) in groups"
            :key="groupName"
            class="apos-command-menu-shortcut-group"
          >
            <div>{{ group.label }}</div>
            <div
              v-for="(command, commandName) in group.fields"
              :key="commandName"
              class="apos-command-menu-shortcut-command"
            >
              <div>{{ command.label }}</div>
            </div>
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin'; // TODO keep?

export default {
  name: 'AposCommandMenuShortcut',
  mixins: [ AposThemeMixin ], // TODO keep?
  props: {
    commands: { // TODO keep?
      type: Array,
      default: function () {
        return [];
      }
    }
  },
  emits: [ 'safe-close' ], // TODO keep?
  data() {
    return {
      groups: apos.commandMenu.groups,
      modal: {
        active: false,
        type: 'slide',
        showModal: false,
        width: 'two-thirds'
      }
    };
  },
  async mounted() {
    if (apos.modal.stack) {
      const [ , topModal = {} ] = apos.modal.stack || [];
      alert(`${topModal}, ${topModal.componentName}, ${topModal.props?.moduleName}`);
      console.log(apos.modal.stack[0]);
    }

    this.modal.active = true; // TODO keep?
    await open(); // TODO keep?
  },
  methods: {
    async open() {
      const moduleName = this.moduleName;
      self.apos.util.error(apos.modules[moduleName].components.shortcutModal, {
        moduleName
      }); // TODO remove
      await apos.modal.execute(apos.modules[moduleName].components.shortcutModal, {
        moduleName
      });
    }
  }
};
</script>

<style lang="scss" scoped>
/*
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
*/
</style>
