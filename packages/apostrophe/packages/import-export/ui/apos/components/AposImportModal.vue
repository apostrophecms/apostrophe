<template>
  <AposModal
    class="apos-import"
    :modal="modal"
    @esc="cancel"
    @no-modal="$emit('safe-close')"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @ready="ready"
  >
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <h2 class="apos-import__heading">
            {{ $t('aposImportExport:import', { type: moduleLabel }) }}
          </h2>
          <!-- eslint-disable vue/no-v-html -->
          <p
            class="apos-import__description"
            v-html="
              $t('aposImportExport:importModalDescription', {
                formats: formatsLabel
              })
            "
          />
          <!-- eslint-enable vue/no-v-html -->
          <AposFile
            class="apos-import__file"
            :allowed-extensions="formatsExtension"
            @upload-file="uploadImportFile"
            @update="updateImportFile"
          />
          <div
            v-if="showImportDraftsOnlyOption"
            class="apos-import__checkbox-wrapper"
          >
            <AposCheckbox
              v-model="checked"
              class="apos-import__import-checkbox"
              :choice="{
                value: 'importDraftsOnly',
                label: 'aposImportExport:importDraftsOnly'
              }"
              :field="{
                name: 'importDraftsOnly',
              }"
              data-apos-test="draftsOnlyCheckbox"
            />
            <AposIndicator
              icon="information-outline-icon"
              tooltip="aposImportExport:importDraftsOnlyTooltip"
            />
          </div>
          <div
            v-if="showTranslateOption"
            class="apos-import__checkbox-wrapper"
          >
            <AposCheckbox
              v-model="checked"
              class="apos-import__import-checkbox"
              :choice="{
                value: 'translate',
                label: 'aposImportExport:importTranslate'
              }"
              :field="{
                name: 'translate',
                readOnly: translationOptionDisabled
              }"
              data-apos-test="translateCheckbox"
            />
            <AposIndicator
              icon="information-outline-icon"
              tooltip="aposImportExport:importTranslateTooltip"
            />
          </div>
          <div class="apos-import__warning-wrapper">
            <AposLabel
              label="aposImportExport:importWarning"
              class="apos-import__warning"
              :modifiers="['apos-is-warning', 'apos-is-filled']"
            />
          </div>
          <div class="apos-import__separator" />
          <div class="apos-import__btns">
            <AposButton
              ref="cancelButton"
              class="apos-import__btn"
              label="apostrophe:cancel"
              @click="cancel"
            />
            <AposButton
              class="apos-import__btn"
              icon="apos-import-export-upload-icon"
              :label="$t('aposImportExport:import', { type: moduleLabel })"
              type="primary"
              :disabled="!selectedFile"
              @click="runImport"
            />
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import bigUpload from 'Modules/@apostrophecms/http/big-upload-client.js';
import { useNotificationStore } from 'Modules/@apostrophecms/ui/stores/notification.js';
import { mapActions } from 'pinia';

export default {
  props: {
    // The Manager context menu items send moduleAction
    moduleAction: {
      type: String,
      default: ''
    },
    // The Editor context menu items send moduleName
    moduleName: {
      type: String,
      default: ''
    },
    action: {
      type: String,
      required: true
    },
    labels: {
      type: Object,
      default: () => ({
        singular: '',
        plural: ''
      })
    }
  },
  emits: [ 'safe-close' ],

  data() {
    const checked =
      apos.modules['@apostrophecms/import-export'].importDraftsOnlyDefault === true
        ? [ 'importDraftsOnly' ]
        : [];

    return {
      modal: {
        active: false,
        type: 'overlay',
        showModal: false,
        disableHeader: true
      },
      selectedFile: null,
      checked
    };
  },

  computed: {
    moduleLabel() {
      // Indicates this is an Editor context menu item action.
      if (this.moduleAction) {
        return this.$t(this.labels.plural);
      }
      // Use the module label, fallback to the plural label (which is most
      // likely empty).
      return this.$t(
        apos.modules[this.moduleName]?.label ?? this.labels.plural
      );
    },
    showImportDraftsOnlyOption() {
      return apos.modules[this.moduleName]?.autopublish !== true;
    },
    showTranslateOption() {
      return apos.modules['@apostrophecms/translation'].enabled === true;
    },
    translationOptionDisabled() {
      return this.fileExtension !== 'gz';
    },
    formats() {
      return apos.modules['@apostrophecms/import-export'].formats;
    },
    formatsLabel() {
      return this.formats
        .map((format) => format.label)
        .join(` ${this.$t('aposImportExport:or')} `);
    },
    formatsExtension() {
      return this.formats.map((format) => format.allowedExtension).join(',');
    },
    universalModuleAction() {
      if (this.moduleAction) {
        return this.moduleAction;
      }
      return apos.modules[this.moduleName]?.action;
    },
    fileExtension() {
      if (!this.selectedFile) {
        return '';
      }
      return this.selectedFile.name.split('.').pop();
    }
  },

  mounted() {
    this.modal.active = true;
  },

  methods: {
    ...mapActions(useNotificationStore, [ 'updateProcess', 'dismiss' ]),
    ready() {
      this.$refs.cancelButton.$el.querySelector('button').focus();
    },
    uploadImportFile(file) {
      if (file) {
        this.selectedFile = file;
      }
    },
    updateImportFile() {
      this.selectedFile = null;
    },
    cancel() {
      this.modal.showModal = false;
    },
    startProcess(notifId) {
      return (processed, total) => {
        if (processed === total) {
          return this.dismiss(notifId);
        }

        this.updateProcess(notifId, processed, total);
      };
    },
    async upload(notifId) {
      try {
        await bigUpload(`${this.universalModuleAction}/${this.action}`, {
          files: {
            file: this.selectedFile
          },
          body: {
            importDraftsOnly: this.checked.includes('importDraftsOnly'),
            translate: this.checked.includes('translate')
          },
          progress: this.startProcess(notifId)
        });
      } catch (e) {
        apos.bus.$emit('import-export-import-ended');
      }
    },
    async runImport() {
      if (!this.universalModuleAction) {
        apos.notify('aposImportExport:importFailed', {
          type: 'danger',
          dismiss: true
        });
        return;
      }
      apos.bus.$emit('import-export-import-started');

      const notifId = await apos.notify('apostrophe:uploading', {
        type: 'progress',
        clientOnly: true,
        icon: 'cloud-upload-icon',
        interpolate: {
          name: this.selectedFile.name
        }
      });

      // Do not await this (upload being processed while modal is closed)
      this.upload(notifId);

      this.modal.showModal = false;
    }
  }
};
</script>

<style scoped lang="scss">
.apos-import {
  z-index: $z-index-modal;
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  &__heading {
    @include type-title;

    & {
      line-height: var(--a-line-tall);
      margin: 0;
    }
  }

  &__warning {
    @include type-small;

    & {
      max-width: 348px;
      padding: 10px;
    }
  }

  &__checkbox-wrapper {
    display: flex;
    align-items: center;
    margin-top: 10px;
    gap: 5px;
  }

  &__warning-wrapper {
    display: flex;
    align-items: center;
    margin-top: 30px;
    margin-bottom: 10px;
    gap: 5px;
  }

  &__description {
    @include type-base;

    & {
      max-width: 370px;
      line-height: var(--a-line-tallest);
    }
  }

  &__file {
    min-width: 370px;
  }

  &__separator {
    position: relative;
    width: calc(100% - 10px);
    height: 1px;
    margin: 10px 0;
    background-color: var(--a-base-9);

    &::before {
      position: absolute;
      right: 0;
      left: -30px;
      width: calc(100% + 60px);
      height: 100%;
      content: "";
      background-color: var(--a-base-9);
    }
  }

  &__btns {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin-top: 10px;
  }

  &__btn {
    & + & {
      margin-left: $spacing-double;
    }
  }
}

:deep(.apos-modal__inner) {
  inset: auto;
  max-width: 700px;
  height: auto;
  text-align: left;
}

:deep(.apos-modal__body-main) {
  display: flex;
  flex-direction: column;
  align-items: baseline;
}

:deep(.apos-modal__body) {
  padding: 30px 20px;
}
</style>
