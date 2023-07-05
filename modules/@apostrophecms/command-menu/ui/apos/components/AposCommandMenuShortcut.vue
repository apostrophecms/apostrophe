<template>
  <AposModal
    :modal="modal"
    class="apos-command-menu-shortcut"
    @esc="close"
    @no-modal="$emit('safe-close')"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
  >
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <header class="apos-modal__header">
            <div class="apos-modal__header__main">
              <AposButton
                type="default"
                :title="$t('apostrophe:commandMenuEsc')"
                :icon-only="true"
                icon="keyboard-esc"
                @click="close"
              />
              <h2 class="apos-modal__heading">
                {{ $t('apostrophe:commandMenuShortcut') }}
              </h2>
            </div>
          </header>
          <section class="apos-command-menu-shortcut-groups">
            <div
              v-for="(group, groupName) in groups"
              :key="groupName"
              class="apos-command-menu-shortcut-group"
            >
              <h3 class="apos-command-menu-shortcut-group-title">
                {{ getLabel(group.label) }}
              </h3>
              <div
                v-for="(command, commandName) in group.commands"
                :key="commandName"
                class="apos-command-menu-shortcut-command"
                :aria-keyshortcuts="command.shortcut"
              >
                <div class="apos-command-menu-shortcut-command-title">
                  {{ getLabel(command.label) }}
                </div>
                <AposCommandMenuKeyList :shortcut="command.shortcut" />
              </div>
            </div>
          </section>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
export default {
  name: 'AposCommandMenuShortcut',
  emits: [ 'safe-close' ],
  data() {
    return {
      groups: apos.commandMenu.modals.default,
      modal: {
        busy: false,
        active: false,
        trapFocus: false,
        type: 'overlay',
        showModal: false,
        disableHeader: true
      }
    };
  },
  computed: {
    hasCommands() {
      return Object.keys(this.groups).length;
    }
  },
  mounted() {
    apos.bus.$on('modal-launched', this.autoCloseWhenHidden);
    apos.bus.$on('modal-resolved', this.close);

    this.modal.active = true;

    const commandMenuModal = apos.commandMenu.getModal();
    const groups = apos.commandMenu.modals[commandMenuModal] || {};
    this.groups = groups;

    if (!this.hasCommands) {
      this.$emit('safe-close');
    }
  },
  beforeDestroy() {
    apos.bus.$off('modal-launched', this.autoCloseWhenHidden);
    apos.bus.$off('modal-resolved', this.close);
  },
  methods: {
    autoCloseWhenHidden(modal) {
      const properties = apos.modal.getProperties(modal.id);
      if (properties.itemName !== '@apostrophecms/command-menu:shortcut') {
        this.close();

        return;
      }

      const subModal = apos.modal.getAt(-2);
      const subProperties = apos.modal.getProperties(subModal.id);
      if (subProperties.itemName === '@apostrophecms/command-menu:shortcut') {
        this.close();
      }
    },
    close() {
      this.modal.showModal = false;
    },
    getLabel(label) {
      if (label && label.key && label.type) {
        return this.$t({
          key: label.key,
          type: this.$t(label.type)
        });
      }

      return this.$t(label);
    }
  }
};
</script>

<style lang="scss" scoped>
::v-deep .apos-modal__body {
  padding: 0;
}

::v-deep .apos-modal__inner {
  top: auto;
  left: auto;
  max-width: 700px;
  height: auto;
  border-radius: $spacing-base + $spacing-half;
}

::v-deep .apos-modal__overlay {
  display: none;
}

.apos-modal__header {
  display: flex;
  justify-content: space-between;
  width: 100%;
  border-bottom: 1px solid var(--a-base-8);
  padding: $spacing-base + $spacing-half 0;

  .apos-modal__header__main {
    display: flex;
    padding: 0 $spacing-base + $spacing-half;
  }

  ::v-deep .apos-button {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    width: auto;
    height: $spacing-double;
    padding: 3px $spacing-half;
    margin-right: $spacing-base;
    vertical-align: bottom;
    border-radius: 3px;
    border-color: var(--a-base-7);
    border-bottom: 2px solid var(--a-base-7);
  }
}
.apos-modal__heading {
  display: inline-block;
  margin: 0;
  @include type-base;
  font-size: var(--a-type-large);
  line-height: $spacing-double;
}

.apos-command-menu-key {
  ::v-deep button {
    width: $spacing-double;
    height: $spacing-double;
    padding: 3px $spacing-half;
    margin-left: $spacing-half;
    box-sizing: border-box;
    border-radius: 3px;
    border-color: var(--a-base-7);
    border-bottom: 2px solid var(--a-base-7);
  }
}

.apos-command-menu-shortcut-groups {
  padding: $spacing-base $spacing-double $spacing-base + $spacing-half;
}
.apos-command-menu-shortcut-group + .apos-command-menu-shortcut-group {
  padding-top: $spacing-base + $spacing-half;
}
.apos-command-menu-shortcut-group {
  @include type-base;
  font-weight: 400;
}
.apos-command-menu-shortcut-group-title {
  height: 24px;
  margin: 0;
  padding: $spacing-half 0;
  box-sizing: border-box;
  @include type-base;
  color: var(--a-base-3);
  text-align: left;
}
.apos-command-menu-shortcut-command {
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  height: 28px;
  padding: $spacing-half 0;
}
.apos-command-menu-shortcut-command-title {
  flex: 1 1 auto;
  margin-right: $spacing-base;
}

</style>
