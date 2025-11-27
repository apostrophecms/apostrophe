<template>
  <AposModal
    :modal="modal"
    class="apos-import-duplicate"
    @esc="cancel"
    @no-modal="closeModal"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @ready="ready"
  >
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <h2 class="apos-import-duplicate__heading">
            {{ $t('aposImportExport:import', { type: moduleLabel }) }}
          </h2>
          <p class="apos-import-duplicate__description">
            <strong>{{ $t('aposImportExport:importDuplicateDetected') }}</strong><br>
            {{ $t('aposImportExport:importDuplicateMessage') }}
          </p>

          <div class="apos-import-duplicate__section">
            <table class="apos-table">
              <thead>
                <tr>
                  <th class="apos-table__header">
                    <AposButton
                      class="apos-toggle"
                      :class="{ 'apos-toggle--blank': !checked.length }"
                      data-apos-test="contextMenuTrigger"
                      type="quiet"
                      :text-color="checkboxIconColor"
                      :icon="checkboxIcon"
                      :icon-only="true"
                      :icon-size="10"
                      @click.stop="toggle"
                    />
                  </th>
                  <th class="apos-table__header">
                    {{ $t('aposImportExport:title') }}
                  </th>
                  <th class="apos-table__header">
                    {{ $t('aposImportExport:type') }}
                  </th>
                  <th class="apos-table__header">
                    {{ $t('aposImportExport:lastEdited') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="doc in duplicatedDocs"
                  :key="doc.aposDocId"
                  class="apos-table__row"
                >
                  <td class="apos-table__cell">
                    <AposCheckbox
                      v-model="checked"
                      tabindex="-1"
                      :choice="{
                        value: doc.aposDocId,
                        label: doc.title
                      }"
                      :field="{
                        label: doc.title,
                        name: doc.aposDocId,
                        hideLabel: true
                      }"
                    />
                  </td>
                  <td class="apos-table__cell">
                    {{ doc.title }}
                  </td>
                  <td class="apos-table__cell">
                    {{ docLabel(doc) }}
                  </td>
                  <td class="apos-table__cell">
                    {{ lastEdited(doc) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="apos-import-duplicate__separator" />

          <div class="apos-import-duplicate__btns">
            <AposButton
              class="apos-import-duplicate__btn"
              label="apostrophe:cancel"
              @click="cancel"
            />
            <AposButton
              ref="runOverride"
              class="apos-import-duplicate__btn"
              :label="$t('aposImportExport:importDuplicateContinue')"
              type="primary"
              @click="runOverride"
            />
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import dayjs from 'dayjs';

export default {
  props: {
    type: {
      type: String,
      required: true
    },
    importDraftsOnly: {
      type: Boolean,
      required: true
    },
    translate: {
      type: Boolean,
      required: true
    },
    overrideLocale: {
      type: Boolean,
      required: true
    },
    duplicatedDocs: {
      type: Array,
      required: true
    },
    exportId: {
      type: String,
      required: true
    },
    importedAttachments: {
      type: Array,
      required: true
    },
    formatLabel: {
      type: String,
      required: true
    },
    jobId: {
      type: String,
      required: true
    },
    notificationId: {
      type: String,
      required: true
    }
  },

  emits: [ 'safe-close', 'change' ],

  data() {
    return {
      modal: {
        active: false,
        type: 'overlay',
        showModal: false,
        disableHeader: true
      },
      checked: [],
      importRunning: false
    };
  },
  computed: {
    moduleLabel() {
      const moduleOptions = apos.modules[this.type];
      const label = moduleOptions.pluralLabel;

      return this.$t(label).toLowerCase();
    },
    checkboxIcon() {
      if (!this.checked.length) {
        // we could return `null` but having no svg when no element are selected
        // makes a shifting glitch
        return 'checkbox-blank-icon';
      }
      if (this.checked.length === this.duplicatedDocs.length) {
        return 'check-bold-icon';
      }
      return 'minus-icon';
    },
    checkboxIconColor() {
      return this.checked.length
        ? 'var(--a-white)'
        : 'transparent';
    }
  },

  async mounted() {
    this.modal.active = true;
    this.checked = this.duplicatedDocs.map(({ aposDocId }) => aposDocId);
  },

  methods: {
    async closeModal() {
      if (!this.importRunning) {
        await this.cleanExportFile();
      }
      this.$emit('safe-close');
    },
    async cleanExportFile() {
      try {
        await apos.http.post('/api/v1/@apostrophecms/import-export/clean-export', {
          body: {
            exportId: this.exportId,
            jobId: this.jobId,
            notificationId: this.notificationId
          }
        });
      } catch (error) {
        apos.notify('aposImportExport:importCleanFailed', {
          type: 'warning'
        });
      } finally {
        apos.bus.$emit('import-export-import-ended');
      }
    },
    ready() {
      this.$refs.runOverride.$el.querySelector('button').focus();
    },
    async runOverride() {
      this.importRunning = true;
      apos.http.post('/api/v1/@apostrophecms/import-export/override-duplicates', {
        body: {
          docIds: this.checked,
          duplicatedDocs: this.duplicatedDocs,
          importedAttachments: this.importedAttachments,
          exportId: this.exportId,
          jobId: this.jobId,
          importDraftsOnly: this.importDraftsOnly,
          translate: this.translate,
          overrideLocale: this.overrideLocale,
          formatLabel: this.formatLabel
        }
      }).catch(() => {
        apos.notify('aposImportExport:exportFailed', {
          type: 'danger',
          dismiss: true
        });
      }).finally(() => {
        this.cleanExportFile();
      });

      this.modal.showModal = false;
    },
    async cancel() {
      this.modal.showModal = false;
    },
    toggle() {
      this.checked = this.checked.length
        ? []
        : this.duplicatedDocs.map(({ aposDocId }) => aposDocId);
    },
    docLabel(doc) {
      const moduleOptions = apos.modules[doc.type];

      return moduleOptions?.label
        ? this.$t(moduleOptions?.label)
        : doc.type;
    },
    lastEdited(doc) {
      return dayjs(doc.updatedAt).format(this.$t('aposImportExport:dayjsTitleDateFormat'));
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-import-duplicate {
  z-index: $z-index-modal;
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.apos-modal__inner) {
  inset: auto;
  height: auto;
  text-align: left;
}

:deep(.apos-modal__overlay) {
  .apos-modal.apos-export & {
    display: block;
  }
}

:deep(.apos-modal__body) {
  padding: 30px 20px;
}

:deep(.apos-modal__body-main) {
  display: flex;
  flex-direction: column;
  align-items: baseline;
}

:deep(.apos-toggle__slider) {
  display: flex;
}

.apos-import-duplicate__heading {
  @include type-title;

  & {
    line-height: var(--a-line-tall);
    margin: 0;
    text-transform: capitalize;
  }
}

.apos-import-duplicate__description {
  @include type-base;

  & {
    width: calc(100% - 20px);
    margin-top: 15px;
    margin-bottom: 20px;
    padding: 10px;
    color: var(--a-warning-dark);
    font-size: var(--a-type-large);
    text-align: left;
    line-height: var(--a-line-tallest);
    background-color: var(--a-warning-fade);
  }
}

.apos-import-duplicate__section {
  @include type-base;

  & {
    display: flex;
    flex-direction: column;
    align-items: baseline;
    max-height: 210px;
    overflow-y: auto;
  }
}

.apos-import-duplicate__section thead {
  position: sticky;
  top: 0;
  background-color: var(--a-background-primary);
}

.apos-import-duplicate__section .apos-table__header {
  font-weight: inherit;
  padding: 5px 15px;
}

.apos-import-duplicate__section .apos-table__cell {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
}

// Override button to style it exactly like other checkboxes
:deep(.apos-toggle) {
  .apos-button {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    align-self: flex-start;
    justify-content: center;
    width: 12px;
    height: 12px;
    padding: 0;
    border: 1px solid var(--a-primary);
    transition: all 0.1 ease-in-out;
    border-radius: 3px;
    background-color: var(--a-primary);
  }

  .apos-button:hover:not([disabled]),
  .apos-button:focus:not([disabled]) {
    transform: none;
  }

  .apos-button:focus {
    box-shadow: 0 0 10px var(--a-primary);
  }
}

:deep(.apos-toggle--blank) {
  .apos-button {
    border-color: var(--a-base-4);
    background-color: var(--a-base-10);
  }

  .apos-button:hover {
    border-color: var(--a-base-2);
  }

  .apos-button:focus {
    outline: none;
    box-shadow: 0 0 5px var(--a-base-1);
  }

  .apos-button svg {
    // We need to hide the checkbox-blank-icon svg
    // (wish there were a "blank" svg in the material icons)
    // because it is visible inside the input. Just changing the color to transparent
    // is not enough as a glitch briefly appears. Hiding it solves it all.
    visibility: hidden;
  }
}

.apos-import-duplicate__separator {
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

:deep(.apos-schema .apos-field) {
  margin-bottom: $spacing-base;
}

.apos-import-duplicate__btns {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: 10px;
  gap: 20px;
}

.apos-import-duplicate__btn :deep(.apos-button__label) {
  text-transform: capitalize;
}
</style>
