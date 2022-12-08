<template>
  <AposModal
    v-if="hasCommands"
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
                {{ $t(group.label) }}
              </h3>
              <div
                v-for="(command, commandName) in group.commands"
                :key="commandName"
                class="apos-command-menu-shortcut-command"
              >
                <div class="apos-command-menu-shortcut-command-title">
                  {{ $t(command.label) }}
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
import AposThemeMixin from 'Modules/@apostrophecms/ui/mixins/AposThemeMixin'; // TODO keep?

export default {
  name: 'AposCommandMenuShortcut',
  mixins: [ AposThemeMixin ], // TODO keep?
  emits: [ 'safe-close' ], // TODO keep?
  data() {
    return {
      groups: apos.commandMenu.modals.default,
      modal: {
        busy: false,
        active: false,
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
    this.modal.active = true; // TODO keep?

    const relatedModal = apos.modal.getAt(-2);
    const properties = apos.modal.getProperties(relatedModal.id) || {};

    const groups = apos.commandMenu.modals[properties.itemName || 'default'] || {};
    this.groups = groups;
  },
  methods: {
    close() {
      this.modal.showModal = false;
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-command-menu-shortcut {
  // TODO remove
}

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
    width: 100%;
    padding: 0 $spacing-base + $spacing-half;
  }

  ::v-deep .apos-button {
    padding: 3px $spacing-half;
    border-radius: 3px;
    border-color: #C8C7C0;
    border-bottom: 2px solid #C8C7C0;
    box-sizing: border-box;
    width: auto;
    height: $spacing-double;
    margin-right: $spacing-base;
    vertical-align: bottom;
  }
}
.apos-modal__heading {
  margin: 0;
  display: inline-block;
  @include type-base;
  font-size: 18px;
  line-height: $spacing-double;
}

.apos-command-menu-key {
  ::v-deep button {
    padding: 3px $spacing-half;
    border-radius: 3px;
    border-color: #C8C7C0;
    border-bottom: 2px solid #C8C7C0;
    box-sizing: border-box;
    width: $spacing-double;
    height: $spacing-double;
    margin-left: $spacing-half;
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
}
.apos-command-menu-shortcut-group-title {
  @include type-base;
  color: var(--a-base-3);
  text-align: left;
  padding: 0;
  margin: 0;
  height: 24px;
  box-sizing: border-box;
  padding: $spacing-half 0;
}
.apos-command-menu-shortcut-command {
  box-sizing: border-box;
  height: 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: $spacing-half 0;
}
.apos-command-menu-shortcut-command-title {
  flex: 1 1 auto;
}

</style>
