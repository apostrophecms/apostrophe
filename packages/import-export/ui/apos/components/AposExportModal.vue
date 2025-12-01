<template>
  <AposModal
    :modal="modal"
    class="apos-export"
    @esc="cancel"
    @no-modal="$emit('safe-close')"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @ready="ready"
  >
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <h2 class="apos-export__heading">
            {{ $t('aposImportExport:export', { type: moduleLabel }) }}
          </h2>
          <p
            class="apos-export__description"
          >
            {{
              $t('aposImportExport:exportModalDescription', {
                count: selectedDocIds.length,
                type: moduleLabel
              })
            }}
          </p>

          <div class="apos-export__section">
            <div class="apos-export__settings">
              {{ $t('aposImportExport:exportModalSettingsLabel') }}
            </div>
            <div class="apos-export__separator" />

            <div class="apos-export__settings-row">
              <div>{{ $t('aposImportExport:exportModalDocumentFormat') }}</div>
              <AposSelect
                :choices="formatChoices"
                :selected="formatName"
                :wrapper-classes="[ 'apos-field--small' ]"
                @change="onFormatChange"
              />
            </div>

            <!-- TODO: Next iteration should support inclusion of page
                        children while exporting -->
            <!-- <div -->
            <!--   v-if="moduleName === '@apostrophecms/page'" -->
            <!--   class="apos-export__settings-row" -->
            <!-- > -->
            <!--   <div>{{ $t('aposImportExport:exportModalIncludeChildren') }}</div> -->
            <!--   <AposToggle -->
            <!--     v-model="relatedChildrenDisabled" -->
            <!--     class="apos-export__toggle" -->
            <!--     @toggle="toggleRelatedChildren" -->
            <!--   /> -->
            <!-- </div> -->

            <div class="apos-export__settings-row">
              <div>{{ $t('aposImportExport:exportModalIncludeRelated') }}</div>
              <AposToggle
                v-model="relatedDocumentsDisabled"
                class="apos-export__toggle"
                @toggle="toggleRelatedDocuments"
              />
            </div>
          </div>

          <transition
            name="slide"
            duration="200"
          >
            <div
              v-show="!relatedDocumentsDisabled"
              class="apos-export__section apos-export__section__related-documents"
            >
              <div class="apos-export__settings">
                {{ $t('aposImportExport:exportModalIncludeRelatedSettings') }}
              </div>
              <div class="apos-export__separator" />
              <div class="apos-export__settings-row apos-export__settings-row--column">
                <div class="apos-export__related-description">
                  {{ $t('aposImportExport:exportModalRelatedDocumentDescription') }}
                </div>

                <AposCheckbox
                  tabindex="-1"
                  data-apos-test="toggleAllRelated"
                  :choice="{
                    value: 'all',
                    label: 'aposImportExport:exportModalToggleAllRelated',
                    indeterminate: toggleAllIndeterminate
                  }"
                  :field="{
                    name: 'all'
                  }"
                  :model-value="toggleAllChecked"
                  @updated="toggleAllRelatedTypes"
                />
                <div class="apos-export__separator" />

                <div
                  v-if="relatedTypes && relatedTypes.length"
                  class="apos-export__related-list"
                >
                  <AposCheckbox
                    v-for="relatedType in relatedTypes"
                    :key="relatedType"
                    v-model="checkedRelatedTypes"
                    tabindex="-1"
                    :choice="{
                      value: relatedType,
                      label: getRelatedTypeLabel(relatedType)
                    }"
                    :field="{
                      label: getRelatedTypeLabel(relatedType),
                      name: relatedType
                    }"
                    @updated="toggleRelatedType"
                  />
                </div>
                <div v-else>
                  {{ $t('aposImportExport:exportModalNoRelatedTypes') }}
                </div>
              </div>
            </div>
          </transition>

          <div class="apos-export__separator apos-export__separator--full-width" />

          <div class="apos-export__btns">
            <AposButton
              class="apos-export__btn"
              label="apostrophe:cancel"
              @click="cancel"
            />
            <AposButton
              ref="runExport"
              icon="apos-import-export-download-icon"
              class="apos-export__btn"
              :label="$t('aposImportExport:export', { type: moduleLabel })"
              type="primary"
              @click="runExport"
            />
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
export default {
  props: {
    moduleName: {
      type: String,
      default: ''
    },
    checked: {
      type: Array,
      default: () => []
    },
    checkedTypes: {
      type: Array,
      default: null
    },
    doc: {
      type: Object,
      default: null
    },
    action: {
      type: String,
      required: true
    },
    messages: {
      type: Object,
      default: () => ({})
    },
    moduleLabels: {
      type: Object,
      default: null
    }
  },

  emits: [ 'change', 'safe-close' ],

  data() {
    return {
      modal: {
        active: false,
        type: 'overlay',
        showModal: false,
        disableHeader: true
      },
      formValues: null,
      relatedDocumentsDisabled: true,
      relatedChildrenDisabled: true,
      relatedTypes: null,
      checkedRelatedTypes: [],
      type: this.moduleName,
      formatName: apos.modules['@apostrophecms/import-export'].formats[0].name,
      selectedDocIds: [],
      toggleAllChecked: true,
      toggleAllIndeterminate: false
    };
  },

  computed: {
    moduleLabel() {
      const labels = this.moduleLabels || apos.modules[this.moduleName];
      const label = this.count > 1
        ? labels.plural || labels.pluralLabel
        : labels.singular || labels.label;

      return this.$t(label).toLowerCase();
    },
    count() {
      return this.selectedDocIds.length;
    },
    formats() {
      return apos.modules['@apostrophecms/import-export'].formats;
    },
    formatChoices() {
      return this.formats.map(format => ({
        label: format.label,
        value: format.name
      }));
    },
    checkedTypesComputed() {
      return this.checkedTypes || [ this.type ];
    }
  },

  async mounted() {
    this.modal.active = true;
    this.selectedDocIds = [
      ...this.checked,
      ...this.doc ? [ this.doc._id ] : []
    ];

    if (this.type === '@apostrophecms/page') {
      this.type = this.doc?.type;
    }

    await this.getRelatedTypes();
  },

  methods: {
    ready() {
      this.$refs.runExport.$el.querySelector('button').focus();
    },
    async getRelatedTypes() {
      this.relatedTypes = await apos.http.get('/api/v1/@apostrophecms/import-export/related', {
        busy: true,
        qs: {
          types: this.checkedTypesComputed
        }
      });
      this.checkedRelatedTypes = this.relatedTypes;
    },
    async runExport() {
      const relatedTypes = this.relatedDocumentsDisabled
        ? []
        : this.checkedRelatedTypes;

      const { action } = apos.modules[this.moduleName];

      try {
        await apos.http.post(`${action}/${this.action}`, {
          busy: true,
          body: {
            _ids: this.selectedDocIds,
            relatedTypes,
            messages: this.messages,
            formatName: this.formatName
          }
        });
      } catch (error) {
        apos.notify('aposImportExport:exportFailed', {
          type: 'danger',
          dismiss: true
        });
      }

      this.modal.showModal = false;
    },
    async cancel() {
      this.modal.showModal = false;
    },
    async toggleRelatedDocuments() {
      this.relatedDocumentsDisabled = !this.relatedDocumentsDisabled;
      if (!this.relatedDocumentsDisabled) {
        this.checkedRelatedTypes = this.relatedTypes;
      }
    },
    toggleRelatedChildren() {
      this.relatedChildrenDisabled = !this.relatedChildrenDisabled;
    },
    getRelatedTypeLabel(moduleName) {
      const moduleOptions = apos.modules[moduleName];
      if (moduleOptions.label) {
        return this.$t(moduleOptions.label);
      } else {
        // Often not set for page types etc.
        return moduleName;
      }
    },
    onFormatChange(formatName) {
      this.formatName = this.formats.find(format => format.name === formatName).name;
    },
    toggleAllRelatedTypes() {
      // From PRO-7989:
      // If a partial selection is made when Toggle All clicked, deselect All
      // If no items selected when Toggle All clicked, select all
      // If all items selected when Toggle All clicked, deselect all
      this.toggleAllChecked = !this.checkedRelatedTypes.length;
      this.toggleAllIndeterminate = false;
      this.checkedRelatedTypes = !this.checkedRelatedTypes.length
        ? this.relatedTypes
        : [];
    },
    toggleRelatedType() {
      this.toggleAllChecked = !!this.checkedRelatedTypes.length;
      this.toggleAllIndeterminate =
        this.checkedRelatedTypes.length !== this.relatedTypes.length;
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-export {
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
  .apos-modal+.apos-export & {
    display: block;
  }
}

:deep(.apos-modal__body) {
  width: 375px;
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

:deep(.apos-input--select) {
  padding-right: 40px;
  line-height: var(--a-line-tall);
}

.apos-export__heading {
  @include type-title;

  & {
    line-height: var(--a-line-tall);
    margin: 0;
    text-transform: capitalize;
  }
}

.apos-export__description {
  @include type-base;

  & {
    margin-top: 5px;
    font-size: var(--a-type-large);
    text-align: left;
    line-height: var(--a-line-tallest);
  }
}

.apos-export__section {
  @include type-base;

  & {
    display: flex;
    flex-direction: column;
    align-items: baseline;
    min-width: 100%;
  }
}

.apos-export__section__related-documents {
  overflow: hidden;
  max-height: 315px;

  &.slide-enter-active,
  &.slide-leave-active {
    transition: max-height 200ms linear;

    // Hide scrollbar during transition,
    // otherwise it will always be visible during the animation
    .apos-export__related-list {
      overflow: hidden;
    }
  }

  &.slide-enter-from,
  &.slide-leave-to {
    max-height: 0;
  }
}

.apos-export__related-list {
  max-height: 210px;
  overflow-y: overlay;
  width: 100%;
}

.apos-export__settings {
  @include type-base;

  & {
    margin-top: 20px;
    color: var(--a-base-3);
    font-weight: 600;
  }
}

.apos-export__settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 43px;
  font-size: var(--a-type-base);
  gap: 70px;
}

.apos-export__settings-row--column {
  overflow: hidden;
  flex-direction: column;
  gap: 0;
  align-items: baseline;
  height: auto;
  margin-bottom: 20px;
}

.apos-export__related-description {
  margin-bottom: 10px;
}

.apos-export__separator {
  position: relative;
  width: calc(100% - 10px);
  height: 1px;
  margin: 10px 0;
  background-color: var(--a-base-9);
}

.apos-export__separator--full-width::before {
  position: absolute;
  right: 0;
  left: -30px;
  width: calc(100% + 60px);
  height: 100%;
  content: "";
  background-color: var(--a-base-9);
}

:deep(.apos-schema) .apos-field {
  margin-bottom: $spacing-base;
}

.apos-export__btns {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: 10px;
  gap: 20px;
}

.apos-export__btn :deep(.apos-button__label) {
  text-transform: capitalize;
}
</style>
