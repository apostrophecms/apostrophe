<template>
  <AposModal
    :modal="modal"
    class="apos-command-menu-shortcut"
    @esc="close"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
  >
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <header class="apos-modal__header">
            <div class="apos-modal__header__main">
              <AposButton
                :attrs="{'data-apos-focus-priority': true}"
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
                  {{ commandLabel(commandName, command) }}
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
import { mapState } from 'pinia';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget';

// These shortcuts already act on the whole selection, or on every widget
// on the clipboard. The registered label stays singular for one widget.
const batchCommandLabels = {
  '@apostrophecms/area:cut-widget': 'apostrophe:commandMenuWidgetsCut',
  '@apostrophecms/area:copy-widget': 'apostrophe:commandMenuWidgetsCopy',
  '@apostrophecms/area:duplicate-widget': 'apostrophe:commandMenuWidgetsDuplicate',
  '@apostrophecms/area:remove-widget': 'apostrophe:commandMenuWidgetsRemove',
  '@apostrophecms/area:paste-widget': 'apostrophe:commandMenuWidgetsPaste'
};

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
    ...mapState(useWidgetStore, [ 'selectedWidgetIds' ]),
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
  beforeUnmount() {
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
    commandLabel(commandName, command) {
      const pluralKey = batchCommandLabels[commandName];
      const count = commandName === '@apostrophecms/area:paste-widget'
        ? (window.apos.area?.widgetClipboard?.getMany?.().length || 0)
        : this.selectedWidgetIds.length;
      if (pluralKey && count > 1) {
        return this.getLabel({
          key: pluralKey,
          count
        });
      }
      return this.getLabel(command.label);
    },
    getLabel(label) {
      if (typeof label === 'object' && label.key) {
        const type = label.type ? this.$t(label.type) : '';

        return this.$t({
          ...label,
          key: label.key,
          type
        });
      }

      return this.$t(label);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-command-menu-shortcut {
  :deep(.apos-modal__body) {
    padding: 0;
  }

  :deep(.apos-modal__inner) {
    inset: auto $spacing-quadruple $spacing-quadruple auto;
    max-width: 700px;
    height: auto;
    border-radius: $spacing-base + $spacing-half;
  }

  :deep(.apos-modal__overlay) {
    display: none;
  }

  :deep(.apos-modal__body-main) {
    padding-bottom: 15px;
  }
}

.apos-modal__header {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: $spacing-base + $spacing-half 0;
  border-bottom: 1px solid var(--a-base-8);

  .apos-modal__header__main {
    display: flex;
    padding: 0 $spacing-base + $spacing-half;
  }

  :deep(.apos-button) {
    display: inline-flex;
    box-sizing: border-box;
    align-items: center;
    width: auto;
    height: $spacing-double;
    margin-right: $spacing-base;
    padding: 3px $spacing-half;
    border-bottom: 2px solid var(--a-base-7);
    vertical-align: bottom;
    border-radius: 3px;
    border-color: var(--a-base-7);
  }
}

.apos-modal__heading {
  @include type-base;

  & {
    display: inline-block;
    margin: 0;
    font-size: var(--a-type-large);
    line-height: $spacing-double;
  }
}

.apos-command-menu-key {
  :deep(button) {
    box-sizing: border-box;
    width: $spacing-double;
    height: $spacing-double;
    margin-left: $spacing-half;
    padding: 3px $spacing-half;
    border-bottom: 2px solid var(--a-base-7);
    border-radius: 3px;
    border-color: var(--a-base-7);
  }
}

.apos-command-menu-shortcut-groups {
  overflow: hidden auto;
  padding: $spacing-base $spacing-double $spacing-base + $spacing-half;
  max-height: 70vh;
}

.apos-command-menu-shortcut-group + .apos-command-menu-shortcut-group {
  padding-top: $spacing-base + $spacing-half;
}

.apos-command-menu-shortcut-group {
  @include type-base;

  & {
    font-weight: 400;
  }
}

.apos-command-menu-shortcut-group-title {
  @include type-base;

  & {
    box-sizing: border-box;
    height: 24px;
    margin: 0;
    padding: $spacing-half 0;
    color: var(--a-base-3);
    text-align: left;
  }
}

.apos-command-menu-shortcut-command {
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 28px;
  padding: $spacing-half 0;
}

.apos-command-menu-shortcut-command-title {
  flex: 1 1 auto;
  margin-right: $spacing-base;
}

</style>
