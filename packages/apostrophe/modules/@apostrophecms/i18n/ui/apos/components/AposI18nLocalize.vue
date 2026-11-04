<template>
  <AposModal
    class="apos-wizard apos-i18n-localize"
    :class="{
      'apos-wizard-busy': wizard.busy,
      'apos-i18n-localize--progress': run.started
    }"
    :modal="modal"
    :modal-data="modalData"
    @esc="close"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
  >
    <template #leftRail>
      <AposModalBody class="apos-wizard__navigation">
        <template #bodyMain>
          <ul class="apos-wizard__navigation__items">
            <li
              v-for="section in visibleSections"
              :key="section.title"
              class="apos-wizard__navigation__item"
              :class="{ 'apos-is-active': isStep(section.name) }"
              :aria-current="isStep(section.name) ? 'step' : null"
            >
              {{ section.title }}
            </li>
          </ul>
        </template>
        <template #footer>
          <!-- While localizing, Cancel stops the run at once: nothing done
               is undone, and localizing again picks up what is left -->
          <div
            v-if="!run.started || run.running"
            class="apos-modal__footer"
          >
            <AposButton
              type="default"
              label="apostrophe:cancel"
              :modifiers="[ 'block' ]"
              :disabled="run.cancelling"
              :attrs="run.running
                ? { 'aria-label': $t('apostrophe:localizingCancelLabel') }
                : {}"
              data-apos-test="localizeCancel"
              @click="run.running ? cancelRun() : cancel()"
            />
          </div>
        </template>
      </AposModalBody>
    </template>
    <template #main>
      <AposModalBody class="apos-wizard__content">
        <template #bodyMain>
          <header class="apos-wizard__header">
            <h2 class="apos-modal__heading">
              {{ $t('apostrophe:localizeContent') }}
            </h2>
          </header>

          <AposI18nLocalizeProgress
            v-if="run.started"
            :view="localizingView"
          />
          <form
            v-else
            class="apos-wizard__form"
            @submit.prevent
          >
            <fieldset
              v-if="isStep('selectContent')"
              class="apos-wizard__step apos-wizard__step-select-content"
            >
              <template v-if="hasRelatedChoice">
                <AposInputRadio
                  v-model="wizard.values.toLocalize"
                  :field="{
                    name: 'to-localize',
                    label: 'apostrophe:selectContentToLocalize',
                    choices: toLocalizeChoices
                  }"
                />
                <p class="apos-wizard__help-text">
                  <AposIndicator
                    class="apos-wizard__help-text__icon"
                    icon="information-icon"
                    :icon-size="16"
                  />
                  {{ $t('apostrophe:relatedDocsDefinition') }}
                </p>
              </template>
              <template v-if="aiScopeAvailable">
                <AposInputRadio
                  v-model="wizard.values.scope"
                  :class="{ 'apos-wizard__scope--below': hasRelatedChoice }"
                  :field="{
                    name: 'localize-scope',
                    label: 'apostrophe:aiLocalizeScopeLabel',
                    choices: [
                      {
                        value: 'onlyNew',
                        label: 'apostrophe:aiLocalizeScopeNew'
                      },
                      {
                        value: 'all',
                        label: 'apostrophe:aiLocalizeScopeAll'
                      }
                    ]
                  }"
                  data-apos-test="localizeScope"
                />
                <p class="apos-wizard__help-text">
                  <AposIndicator
                    class="apos-wizard__help-text__icon"
                    icon="information-icon"
                    :icon-size="16"
                  />
                  {{ $t('apostrophe:aiLocalizeScopeHelp') }}
                </p>
              </template>
            </fieldset>

            <fieldset
              v-if="isStep('selectLocales')"
              class="apos-wizard__step apos-wizard__step-select-locales"
            >
              <AposButton
                class="apos-locale-select-all"
                :label="allSelected
                  ? $t('apostrophe:deselectAll')
                  : $t('apostrophe:selectAll')"
                type="quiet"
                :modifiers="[ 'inline' ]"
                v-on="{ click: allSelected ? deselectAll : selectAll }"
              />
              <AposInputString
                ref="searchInput"
                v-model="searchValue"
                :field="searchField"
                class="apos-locales-filter"
                @update:model-value="updateFilter"
              />
              <transition-group
                tag="ul"
                name="selected-list"
                class="apos-selected-locales"
              >
                <li
                  v-for="loc in selectedLocales"
                  :key="loc.name"
                  class="apos-locale-item--selected"
                >
                  <AposButton
                    type="primary"
                    class="apos-locale-button"
                    :modifiers="[ 'small' ]"
                    icon="close-icon"
                    :icon-size="12"
                    :label="loc.label"
                    @click.prevent="removeLocale(loc)"
                  />
                </li>
              </transition-group>
              <ul class="apos-locales">
                <li
                  v-for="loc in filteredLocales"
                  :key="loc.name"
                  class="apos-locale-item"
                  data-apos-test="localeItem"
                  :class="localeClasses(loc)"
                  @click="toggleLocale(loc)"
                >
                  <span class="apos-locale">
                    <AposIndicator
                      v-if="isCurrentLocale(loc) && !isSelected(loc)"
                      icon="map-marker-icon"
                      class="apos-current-locale-icon"
                      :icon-size="14"
                      :title="$t('apostrophe:i18nDefaultLocale')"
                      tooltip="apostrophe:i18nCurrentLocale"
                    />
                    <AposIndicator
                      v-if="isSelected(loc)"
                      icon="check-bold-icon"
                      class="apos-check-icon"
                      :icon-size="10"
                      :title="$t('apostrophe:i18nCurrentlySelectedLocale')"
                    />
                    {{ loc.label }}
                    <span class="apos-locale-name">
                      ({{ loc.name }})
                    </span>
                    <span
                      v-apos-tooltip="isLocalized(loc)
                        ? 'apostrophe:localizeLocalized'
                        : 'apostrophe:localizeNotYetLocalized'"
                      class="apos-locale-localized"
                      :class="{
                        'apos-state-is-localized': isLocalized(loc),
                      }"
                    />
                  </span>
                </li>
              </ul>
            </fieldset>

            <fieldset
              v-if="isStep('confirmSettings')"
              class="apos-wizard__step apos-wizard__step-confirm-settings"
            >
              <ul class="apos-selected-locales">
                <li
                  v-for="loc in selectedLocales"
                  :key="loc.name"
                  class="apos-locale-item--selected"
                >
                  <AposButton
                    type="primary"
                    class="apos-locale-to-localize"
                    :modifiers="[ 'small' ]"
                    :label="loc.label"
                    :disabled="true"
                  />
                </li>
              </ul>

              <div
                v-if="wizard.values.toLocalize.data !== 'thisDoc'"
                class="apos-wizard__field-group"
              >
                <p class="apos-wizard__field-group-heading">
                  {{ $t('apostrophe:relatedDocSettings') }}
                  <AposIndicator
                    class="apos-wizard__field-group-heading__info"
                    icon="information-icon"
                    :icon-size="14"
                    :tooltip="tooltips.relatedDocSettings"
                  />
                </p>

                <AposInputRadio
                  v-model="wizard.values.relatedDocSettings"
                  :field="{
                    name: 'relatedDocSettings',
                    choices: [
                      {
                        value: 'localizeNewRelated',
                        label: aiMode
                          ? 'apostrophe:aiLocalizeNewAndModifiedRelated'
                          : 'apostrophe:localizeNewRelated',
                      },
                      {
                        value: 'localizeAllRelatedAndOverwriteExisting',
                        label: 'apostrophe:localizeAllRelated',
                        tooltip: tooltips.localizeAllAndOverwrite,
                      },
                    ],
                  }"
                />
                <AposInputCheckboxes
                  v-if="relatedDocTypes.length"
                  v-model="wizard.values.relatedDocTypesToLocalize"
                  :field="relatedDocTypesField"
                />
                <p
                  v-else
                  class="apos-wizard__help-text"
                >
                  <AposIndicator
                    class="apos-wizard__help-text__icon"
                    icon="lightbulb-on-icon"
                    icon-color="var(--a-success)"
                    :icon-size="16"
                  />
                  {{ $t('apostrophe:noNewRelatedDocuments') }}
                </p>
              </div>
              <div
                v-if="translationAvailable"
                class="apos-wizard__translation"
              >
                <p class="apos-wizard__translation-title">
                  <AposTranslationIndicator :size="18" />
                  <span class="apos-wizard__translation-title-text">
                    {{ $t('apostrophe:automaticTranslationSettings') }}
                  </span>
                </p>
                <p
                  v-if="automaticTranslationDisclaimer"
                  class="apos-wizard__translation-disclaimer"
                >
                  {{ automaticTranslationDisclaimer }}
                </p>
                <AposCheckbox
                  v-model="wizard.values.translateContent.data"
                  :field="{ name: 'translate' }"
                  :choice="{
                    value: wizard.values.translateContent.data,
                    label: $t('apostrophe:automaticTranslationCheckbox'),
                    htmlHelp: $t('apostrophe:automaticTranslationCheckboxHelp')
                  }"
                  data-apos-test="localizationTranslationCheck"
                />

                <div v-if="translationErrMsg">
                  <!-- eslint-disable vue/no-v-html -->
                  <p
                    class="apos-wizard__translation-error"
                    data-apos-test="localizationTranslationErr"
                    v-html="translationErrMsg"
                  />
                  <!-- eslint-disable vue/no-v-html -->
                  <AposButton
                    v-if="translationShowRetry"
                    label="apostrophe:retry"
                    :modifiers="['quiet', 'no-motion']"
                    data-apos-test="localizationTranslationRetry"
                    @click="retryTranslationCheck()"
                  />
                </div>
                <div
                  v-else-if="translationShowLoader"
                  class="apos-wizard__translation-spinner"
                >
                  <AposSpinner />
                </div>
              </div>
            </fieldset>
          </form>
        </template>
        <!-- Localizing: Done, disabled until the run ends, or Close when it
             stopped early -->
        <template
          v-if="run.started"
          #footer
        >
          <AposButton
            :type="localizingView.card ? 'default' : 'primary'"
            :label="localizingView.card
              ? 'apostrophe:close'
              : 'apostrophe:localizingDone'"
            :disabled="run.running"
            data-apos-test="localizingDone"
            @click="finishRun"
          />
        </template>
        <template
          v-else
          #footer
        >
          <AposButton
            v-if="isLastStep()"
            :attrs="{'data-apos-focus-priority': true}"
            type="primary"
            label="apostrophe:localizeContent"
            :disabled="!complete() || wizard.busy"
            @click="submit"
          />
          <AposButton
            v-else
            :attrs="{'data-apos-focus-priority': true}"
            type="primary"
            icon="arrow-right-icon"
            :modifiers="['icon-right']"
            :disabled="!complete() || wizard.busy"
            :icon-size="12"
            label="apostrophe:next"
            @click="goToNext()"
          />
          <AposButton
            v-if="!isFirstStep()"
            type="default"
            :disabled="wizard.busy"
            label="apostrophe:back"
            @click="goToPrevious()"
          />
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
export default {
  name: 'AposI18nLocalize',
  props: {
    doc: {
      required: false,
      type: Object,
      default: null
    },
    targetLocale: {
      required: false,
      type: Object,
      default: null
    },
    moduleName: {
      required: true,
      type: String
    },
    modalData: {
      required: true,
      type: Object
    },
    shouldRedirect: {
      type: Boolean,
      default: true
    }
  },
  emits: [ 'modal-result' ],
  data() {
    return {
      modal: {
        busy: false,
        busyTitle: this.$t('apostrophe:localizingBusy'),
        disableHeader: true,
        active: false,
        showModal: false
      },
      locales: Object.entries(window.apos.i18n.locales).map(
        ([ locale, options ]) => {
          return {
            name: locale,
            label: options.label || locale,
            _edit: options._edit
          };
        }
      ),
      localized: {},
      tooltips: {
        relatedDocSettings: this.$t('apostrophe:relatedDocsDefinition'),
        localizeAllAndOverwrite: this.$t('apostrophe:relatedDocOverwriteWarning')
      },
      wizard: {
        step: 'selectContent',
        busy: false,
        sections: {
          selectContent: {
            title: this.$t('apostrophe:selectContent'),
            if() {
              if (!this.allRelatedDocsKnown) {
                // We can't rule it out yet
                return true;
              }
              // Must show step one as long as some related docs
              // exist, as the user might opt in step three
              // to express an interest in previously
              // replicated related docs. It also asks how much to
              // localize whenever AI localization is available
              const hasRelated = this.allRelatedDocs.length > 0;
              if (!hasRelated) {
                this.wizard.values.toLocalize.data = 'thisDoc';
              }
              return hasRelated || this.aiScopeAvailable;
            }
          },
          selectLocales: {
            title: this.$t('apostrophe:selectLocales'),
            filter: '',
            if() {
              return !this.targetLocale;
            },
            complete() {
              return this.selectedLocales.length > 0;
            }
          },
          confirmSettings: {
            title: this.$t('apostrophe:confirmSettings'),
            complete() {
              const {
                toLocalize,
                relatedDocTypesToLocalize
              } = this.wizard.values;

              // If they choose related docs only, they must check at
              // least one related doc type to continue
              return (toLocalize.data !== 'relatedDocsOnly') ||
                this.relatedDocTypes
                  .find(({ value }) => relatedDocTypesToLocalize.data.includes(value));
            }
          },
          // The run, once Localize Content starts it. The steps before it
          // stay listed but can't be gone back to
          localizing: {
            title: this.$t('apostrophe:localizingStep'),
            if() {
              return this.run.started;
            }
          }
        },
        values: {
          toLocalize: { data: 'thisDocAndRelated' },
          // "onlyNew" runs the AI localization flow (see
          // @apostrophecms/ai-localize), the default when it is available
          scope: {
            data: apos.modules['@apostrophecms/ai-localize']?.enabled &&
              (this.$attrs.action !== 'localize')
              ? 'onlyNew'
              : 'all'
          },
          toLocales: { data: this.targetLocale ? [ this.targetLocale ] : [] },
          relatedDocSettings: { data: 'localizeNewRelated' },
          relatedDocTypesToLocalize: { data: [] },
          translateContent: { data: false },
          translateTargets: { data: [] },
          translateProvider: { data: apos.translation.providers[0]?.name || null }
        }
      },
      fullDoc: this.doc,
      // The run shown in the Localizing step, whichever way it localizes:
      // "ai", a job on the server (see @apostrophecms/ai-localize), or
      // "classic", core's whole-document copy, one request per document and
      // locale. `pairs` are each document in each locale, with their status
      // and what they did; `phrase` is what it is doing now; `blocked` says
      // why it never started
      run: {
        started: false,
        kind: null,
        jobId: null,
        translate: false,
        pairs: [],
        phrase: '',
        running: false,
        cancelling: false,
        cancelled: false,
        blocked: null,
        startedAt: 0,
        endedAt: 0
      },
      relatedDocs: [],
      // Includes those that aren't new, even if we are only expressing
      // interest in new docs
      allRelatedDocs: [],
      allRelatedDocsKnown: false,
      docTypesSeen: [],
      relatedDocTypes: [],
      searchField: {
        label: this.$t('apostrophe:searchLocales'),
        placeholder: `${this.$t('apostrophe:searchLocales')}...`
      },
      searchValue: {
        value: '',
        error: false
      },
      // Configured based on the mode we are in (batch vs standalone)
      toLocalizeChoices: [],
      toLocalizeChoicesStandalone: [
        {
          value: 'thisDoc',
          label: 'apostrophe:thisDocument'
        },
        {
          value: 'thisDocAndRelated',
          label: 'apostrophe:thisDocumentAndRelated'
        },
        {
          value: 'relatedDocsOnly',
          label: 'apostrophe:relatedDocsOnly'
        }
      ],
      toLocalizeChoicesBatch: [
        {
          value: 'thisDoc',
          label: 'apostrophe:theseDocuments'
        },
        {
          value: 'thisDocAndRelated',
          label: 'apostrophe:theseDocumentsAndRelated'
        },
        {
          value: 'relatedDocsOnly',
          label: 'apostrophe:relatedDocsOnly'
        }
      ],
      translationEnabled: apos.modules['@apostrophecms/translation'].enabled,
      translationErrMsg: null,
      translationShowRetry: false,
      translationShowLoader: false,
      automaticTranslationDisclaimer: this.$t('apostrophe:automaticTranslationDisclaimer')
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.i18n;
    },
    batchOptions() {
      if (this.$attrs.action === 'localize') {
        return {
          enabled: true,
          action: this.$attrs.action,
          label: this.$attrs.label,
          messages: this.$attrs.messages,
          checked: this.$attrs.checked,
          checkedTypes: this.$attrs.checkedTypes || [ this.moduleName ],
          permission: this.$attrs.permission
        };
      }

      return {
        enabled: false
      };
    },
    isBatchMode() {
      return this.batchOptions.enabled;
    },
    // AI localization handles one document and its related documents; the
    // batch flow keeps the classic copy
    aiScopeAvailable() {
      return Boolean(apos.modules['@apostrophecms/ai-localize']?.enabled) &&
        !this.isBatchMode;
    },
    aiMode() {
      return this.aiScopeAvailable && this.wizard.values.scope.data === 'onlyNew';
    },
    // Translation is offered whenever something can do it: the automatic
    // translation module, or AI, which also translates a whole document when
    // the module is not there (see `aiFullCopy`)
    translationAvailable() {
      return this.translationEnabled || this.aiScopeAvailable;
    },
    // "All content" with translation but no automatic translation module: AI
    // copies each document whole and translates it
    aiFullCopy() {
      return this.aiScopeAvailable && !this.aiMode &&
        !this.translationEnabled &&
        this.wizard.values.translateContent.data;
    },
    localizingView() {
      return this.describeRun();
    },
    hasRelatedChoice() {
      return !this.allRelatedDocsKnown || this.allRelatedDocs.length > 0;
    },
    action() {
      return this.doc.slug.startsWith('/')
        ? apos.page.action
        : apos.modules[this.doc.type].action;
    },
    filteredLocales() {
      const matches = term =>
        term
          .toLowerCase()
          .includes(this.wizard.sections.selectLocales.filter.toLowerCase());

      return this.locales.filter(({ name, label }) => {
        return matches(name) || matches(label);
      });
    },
    selectedLocales() {
      return this.wizard.values.toLocales.data;
    },
    allSelected() {
      return this.selectedLocales.length === this.locales
        .filter(locale => !this.isCurrentLocale(locale) && this.canEditLocale(locale))
        .length;
    },
    relatedDocTypesField() {
      return {
        name: 'related-doc-types-to-localize',
        label: 'apostrophe:relatedDocTypesToLocalize',
        choices: this.relatedDocTypes
      };
    },
    visibleSections() {
      const self = this;
      const result = Object.entries(this.wizard.sections)
        .filter(([ , section ]) => {
          return section.if ? section.if.bind(self)() : true;
        }).map(([ name, section ]) => {
          return {
            name,
            ...section
          };
        });
      return result;
    },
    visibleStepNames() {
      return this.visibleSections.map(section => section.name);
    },
    previousStepName() {
      const names = this.visibleStepNames;
      const result = names[names.indexOf(this.wizard.step) - 1];
      return result;
    },
    nextStepName() {
      const names = this.visibleStepNames;
      const result = names[names.indexOf(this.wizard.step) + 1];
      return result;
    }
  },
  watch: {
    // Debug busy state - controlling disabled state for actions.
    // 'wizard.busy'(newVal) {
    //   console.log('BUSY STATUS', newVal);
    // },
    'wizard.values.relatedDocSettings.data'() {
      if (!this.isBatchMode) {
        this.updateRelatedDocs();
      }
    },
    'wizard.values.toLocalize.data'() {
      if (!this.isBatchMode) {
        this.updateRelatedDocs();
      }
    },
    'wizard.values.scope.data'() {
      if (!this.isBatchMode) {
        this.updateRelatedDocs();
      }
    },
    // Follow the log as it grows, in the modal body's own scrolling (the
    // only scrolling there is), unless the editor scrolled up to read
    async 'wizard.values.translateContent.data'(value) {
      // TODO - fix this as it depends on doc data.
      await this.checkAvailableTranslations(value);
    },
    selectedLocales() {
      if (!this.isBatchMode) {
        this.updateRelatedDocs();
      }
    },
    relatedDocs() {
      for (const doc of this.relatedDocs) {
        if (!this.docTypesSeen.includes(doc.type)) {
          this.docTypesSeen.push(doc.type);
          if (apos.modules[doc.type].relatedDocument) {
            this.wizard.values.relatedDocTypesToLocalize.data.push(doc.type);
          }
        }
      }
    }
  },
  beforeUnmount() {
    this.stopFollowingAi();
  },
  async mounted() {
    this.modal.active = true;
    this.wizard.busy = true;
    this.normalizeConfig();
    if (this.isBatchMode) {
      this.wizard.step = this.visibleStepNames[0];
      this.wizard.busy = false;
      this.setRelatedDocTypes();
    } else {
      try {
        // Always the draft, whichever mode the editor is viewing: that is
        // what gets localized, and its related documents come with draft
        // ids, which the checks below look up in draft mode
        this.fullDoc = await apos.http.get(
          `${this.action}/${this.doc._id.replace(/:published$/, ':draft')}`,
          {
            busy: true,
            qs: { aposMode: 'draft' }
          }
        );

        const docs = await apos.http.get(
          `${this.action}/${this.fullDoc._id}/locales`,
          {
            busy: true
          }
        );
        this.localized = Object.fromEntries(
          docs.results
            .filter(doc => doc.aposLocale.endsWith(':draft'))
            .map(doc => [ doc.aposLocale.split(':')[0], doc ])
        );
        await this.updateRelatedDocs();
      } finally {
        this.wizard.step = this.visibleStepNames[0];
        this.wizard.busy = false;
      }
    }
  },
  methods: {
    setRelatedDocTypes() {
      if (this.isBatchMode) {
        this.relatedDocTypes = this.getRelatedSchemaTypes(this.batchOptions.checkedTypes);
        for (const item of this.relatedDocTypes) {
          if (!this.docTypesSeen.includes(item.value)) {
            this.docTypesSeen.push(item.value);
            this.wizard.values.relatedDocTypesToLocalize.data.push(item.value);
          }
        }
        return;
      }

      const types = {};
      for (const doc of this.relatedDocs) {
        if (!types[doc.type]) {
          types[doc.type] = {
            value: doc.type,
            count: 0,
            readOnly: false
          };
        }
        types[doc.type].count++;
      }
      for (const type of Object.values(types)) {
        const baseLabel = this.plural(type.value);
        type.label = {
          key: 'apostrophe:typeWithCount',
          type: this.$t(baseLabel),
          count: type.count
        };
      }
      this.relatedDocTypes = Object.values(types);

    },
    normalizeConfig() {
      if (this.isBatchMode) {
        this.toLocalizeChoices = this.toLocalizeChoicesBatch;
      } else {
        this.toLocalizeChoices = this.toLocalizeChoicesStandalone;
      }
    },
    confirm() {
      if (!this.modal.busy) {
        this.modal.showModal = false;
        this.$emit('modal-result', true);
      }
    },
    cancel() {
      if (!this.modal.busy) {
        this.modal.showModal = false;
        this.$emit('modal-result', null);
      }
    },
    // Escape. Localizing is modal: while it runs the window stays open, and
    // only Cancel stops it. Once it has ended, closing is the same as Done
    close() {
      if (this.run.running) {
        return;
      }
      if (this.run.started) {
        return this.finishRun();
      }
      this.cancel();
    },
    goTo(name) {
      this.wizard.step = name;
    },
    goToPrevious() {
      this.wizard.step = this.previousStepName;
      this.uncheckTranslate();
    },
    uncheckTranslate() {
      this.wizard.values.translateContent.data = false;
      this.wizard.values.translateTargets.data = [];
      this.translationErrMsg = null;
      this.translationShowRetry = false;
    },
    goToNext() {
      this.goTo(this.nextStepName);
    },
    isFirstStep() {
      return this.wizard.step === this.visibleStepNames[0];
    },
    isLastStep() {
      return this.wizard.step === this.visibleStepNames[this.visibleStepNames.length - 1];
    },
    isStep(name) {
      return this.wizard.step === name;
    },
    isCurrentLocale(locale) {
      return this.modalData.locale === locale.name;
    },
    canEditLocale(locale) {
      return !!locale._edit;
    },
    isSelected(locale) {
      return this.wizard.values.toLocales.data.some(
        ({ name }) => name === locale.name
      );
    },
    isLocalized(locale) {
      return !!this.localized[locale.name];
    },
    selectAll() {
      this.wizard.values.toLocales.data = this.locales
        .filter(locale => !this.isCurrentLocale(locale) && this.canEditLocale(locale));
    },
    deselectAll() {
      this.wizard.values.toLocales.data = [];
    },
    toggleLocale(locale) {
      if (
        !this.isSelected(locale) &&
        !this.isCurrentLocale(locale) &&
          this.canEditLocale(locale)
      ) {
        this.wizard.values.toLocales.data = [
          ...this.wizard.values.toLocales.data,
          locale
        ];

      } else if (this.isSelected(locale)) {
        this.wizard.values.toLocales.data = this.wizard.values.toLocales.data
          .filter(l => l !== locale);
      }
      // Reset search filter
      if (this.filteredLocales.length < 2) {
        this.wizard.sections.selectLocales.filter = '';
        this.searchValue.data = '';
        this.$refs.searchInput.$el.querySelector('input').focus();
      }
    },
    removeLocale(locale) {
      this.wizard.values.toLocales.data = this.wizard.values.toLocales.data.filter(
        obj => {
          return obj.name !== locale.name;
        }
      );
    },
    // Is the given step complete
    complete(stepName) {
      if (!stepName) {
        stepName = this.wizard.step;
      }
      const complete = this.wizard.sections[stepName].complete;
      return !complete || complete.bind(this)();
    },
    // Returns true if all previous steps are complete
    completedPrevious(stepName) {
      for (const _stepName of this.visibleStepNames) {
        if (stepName === _stepName) {
          return true;
        }
        if (!this.complete(_stepName)) {
          return false;
        }
      }
    },
    localeClasses(locale) {
      const classes = {};
      if (this.isCurrentLocale(locale)) {
        classes['apos-current-locale'] = true;
      }
      if (!this.canEditLocale(locale)) {
        classes['apos-disabled-locale'] = true;
      }
      return classes;
    },
    // Singular type name for label (returns an i18next key)
    singular(name) {
      const module = apos.modules[name] || {};
      if (module.action === '@apostrophecms/page') {
        return 'apostrophe:page';
      }
      return module.label || name;
    },
    // Plural type name for label (returns an i18next key)
    plural(name) {
      const module = apos.modules[name] || {};
      if (module.action === '@apostrophecms/page') {
        return 'apostrophe:pages';
      }
      return module.pluralLabel || module.label || name;
    },
    updateFilter(event) {
      if (event && event.data !== undefined) {
        this.wizard.sections.selectLocales.filter = event.data;
      }
    },
    // Localize Content: on to the Localizing step, which follows the run
    // whichever way it localizes. Batches from a manager keep their
    // background job
    async submit() {
      if (this.isBatchMode) {
        return this.submitBatch();
      }
      const docs = this.docsToLocalize();
      const locales = this.selectedLocales.map(({ name }) => name);
      this.wizard.busy = true;
      let blocked = null;
      try {
        blocked = await this.checkParent(docs);
      } catch (e) {
        // The localize request reports it, if it was a real problem
      } finally {
        this.wizard.busy = false;
      }
      const kind = (this.aiMode || this.aiFullCopy) ? 'ai' : 'classic';
      this.startRun({
        kind,
        docs,
        locales,
        blocked
      });
      if (blocked) {
        return this.endRun();
      }
      return kind === 'ai'
        ? this.runAi(docs, locales)
        : this.runClassic();
    },
    // The dialog's document, unless only related documents were chosen, and
    // the related documents of the chosen types
    docsToLocalize() {
      const docs = [];
      if (this.wizard.values.toLocalize.data !== 'relatedDocsOnly') {
        docs.push(this.fullDoc);
      }
      if (this.wizard.values.toLocalize.data !== 'thisDoc') {
        for (const doc of this.relatedDocs) {
          if (
            this.wizard.values.relatedDocTypesToLocalize.data.includes(doc.type) &&
            !docs.some(({ _id }) => _id === doc._id)
          ) {
            docs.push(doc);
          }
        }
      }
      return docs;
    },
    // A page can't be localized into a locale its parent page isn't in yet.
    // Checked before anything changes, for every chosen locale the page is
    // new to: `{ parent, locales }` when the parent is missing from some
    async checkParent(docs) {
      const page = docs.find(({ _id }) => _id === this.fullDoc._id);
      const ids = page?.slug?.startsWith('/') && page.path
        ? page.path.split('/')
        : [];
      if (ids.length < 2) {
        return null;
      }
      const parentId = `${ids.at(-2)}:${this.modalData.locale}:draft`;
      const missing = [];
      for (const { name } of this.selectedLocales) {
        if (this.localized[name]) {
          continue;
        }
        const { aposDocIds } = await apos.http.post(
          `${this.moduleOptions.action}/exist-in-locale`,
          {
            body: {
              ids: [ parentId ],
              locale: name,
              mode: 'draft'
            }
          }
        );
        if (!aposDocIds.includes(ids.at(-2))) {
          missing.push(name);
        }
      }
      if (!missing.length) {
        return null;
      }
      let parent = '';
      try {
        parent = (await apos.http.get(`${apos.page.action}/${parentId}`, {})).title;
      } catch (e) {
        // Named without its title
      }
      return {
        parent,
        locales: missing
      };
    },
    startRun({
      kind, docs, locales, blocked
    }) {
      this.run = {
        started: true,
        kind,
        jobId: null,
        translate: Boolean(this.wizard.values.translateContent.data),
        pairs: docs.flatMap((doc) => locales.map((locale) => ({
          docId: doc._id,
          title: doc.title || '',
          type: doc.type,
          slug: doc.slug,
          related: doc._id !== this.fullDoc._id,
          locale,
          status: 'waiting'
        }))),
        phrase: '',
        running: !blocked,
        cancelling: false,
        cancelled: false,
        blocked,
        startedAt: Date.now(),
        endedAt: 0
      };
      this.wizard.step = 'localizing';
    },
    endRun() {
      for (const pair of this.run.pairs) {
        if ([ 'waiting', 'working' ].includes(pair.status)) {
          pair.status = 'stopped';
        }
      }
      this.run.running = false;
      this.run.cancelling = false;
      this.run.phrase = '';
      this.run.endedAt = Date.now();
    },
    // Cancel while it runs: stops at once, without asking, since nothing
    // done is undone
    async cancelRun() {
      if (!this.run.running || this.run.cancelling) {
        return;
      }
      this.run.cancelling = true;
      this.run.cancelled = true;
      this.run.phrase = this.$t('apostrophe:localizingPhraseStopping');
      if (this.run.jobId) {
        await this.cancelJob();
      }
    },
    async cancelJob() {
      try {
        await apos.http.post(
          `${apos.modules['@apostrophecms/job'].action}/${this.run.jobId}/cancel`,
          { body: {} }
        );
      } catch (e) {
        // The job may have just ended; its end event says how
      }
    },
    // Done, or Close once it stopped early: the usual notification for what
    // was localized, then out. Opened for one locale, it goes there
    async finishRun() {
      if (this.run.running) {
        return;
      }
      // Related documents that were already up to date go unmentioned
      const localized = this.run.pairs.filter(({ status, related }) =>
        status === 'done' || (status === 'upToDate' && !related));
      await this.notifyLocalized(localized.map((pair) => ({
        locale: { name: pair.locale },
        doc: {
          type: pair.type,
          slug: pair.slug
        },
        result: {
          _id: pair.targetId,
          _url: pair.url,
          slug: pair.slug
        }
      })));
      this.modal.showModal = false;
      this.$emit('modal-result', true);
      const arrived = this.targetLocale && this.shouldRedirect &&
        localized.some((pair) => !pair.related &&
          pair.locale === this.targetLocale.name);
      if (arrived) {
        await this.openLocale(this.targetLocale.name);
      }
    },
    // The classic way: core copies each document whole into each locale,
    // translated by the automatic translation module when that was asked for
    async runClassic() {
      const {
        translateTargets, translateProvider, relatedDocSettings
      } =
        this.wizard.values;
      for (const pair of this.run.pairs) {
        if (this.run.cancelled) {
          break;
        }
        const translated = this.run.translate &&
          translateTargets.data.includes(pair.locale);
        pair.status = 'working';
        this.run.phrase = this.$t(translated
          ? 'apostrophe:localizingPhraseTranslating'
          : 'apostrophe:localizingPhraseCopying', {
          title: pair.title,
          locale: this.localeLabel(pair.locale)
        });
        try {
          const result = await apos.http.post(
            `${apos.modules[pair.type].action}/${pair.docId}/localize`,
            {
              body: {
                toLocale: pair.locale,
                update: !pair.related ||
                  relatedDocSettings.data !== 'localizeNewRelated'
              },
              qs: {
                aposTranslateTargets: translateTargets.data,
                aposTranslateProvider: translateProvider.data
              }
            }
          );
          Object.assign(pair, {
            status: 'done',
            mode: !pair.related && this.localized[pair.locale] ? 'replace' : 'new',
            translated,
            targetId: result._id,
            url: result._url,
            slug: result.slug || pair.slug
          });
        } catch (e) {
          // Status code 409 (conflict) means an existing document we opted
          // not to overwrite
          if (e.status === 409) {
            pair.status = 'upToDate';
          } else {
            pair.status = 'failed';
            pair.message = e?.body?.data?.parentNotLocalized
              ? this.$t('apostrophe:parentNotLocalized')
              : e?.body?.data?.detail
                ? this.$t(e.body.data.detail)
                // A bare error name such as "notfound" tells the editor
                // nothing: the generic reason reads better
                : (e?.body?.message !== e?.body?.name && e?.body?.message) || '';
          }
        }
      }
      this.endRun();
    },
    // The notification that ends a localization: `successes` have the
    // target `locale`, the source `doc` and the localized copy as `result`
    async notifyLocalized(successes) {
      const count = successes.length;
      const targetLocales = [ ...new Set(successes.map(item => item.locale.name)) ];
      const managerOpen = apos.modal.get()
        .some(modal => modal.componentName === 'AposRecentlyEditedManager');

      if (count === 1) {
        const item = successes[0];
        const hasUrl = !!item.result?._url;
        await apos.notify('apostrophe:localizingNotificationSuccess', {
          type: 'success',
          icon: 'translate-icon',
          interpolate: { count },
          dismiss: managerOpen,
          ...!managerOpen && {
            buttons: [
              {
                type: 'event',
                label: hasUrl
                  ? 'apostrophe:localizeOpenDocument'
                  : 'apostrophe:localizeEditDocument',
                name: 'localize-open-document',
                data: {
                  _url: item.result?._url || null,
                  type: item.doc.type,
                  _id: item.result?._id || null,
                  locale: item.locale.name,
                  slug: item.result?.slug || item.doc.slug
                }
              }
            ]
          }
        });
      } else if (count > 1) {
        await apos.notify('apostrophe:localizingNotificationSuccess', {
          type: 'success',
          icon: 'translate-icon',
          interpolate: { count },
          dismiss: managerOpen,
          ...!managerOpen && {
            buttons: [
              {
                type: 'event',
                label: 'apostrophe:localizeManageDocuments',
                name: 'localize-manage-documents',
                data: {
                  locales: targetLocales
                }
              }
            ]
          }
        });
      }
    },
    // The locales the AI flow translates into: none unless asked, and with
    // the automatic translation module only those its provider supports, as
    // the dialog has told the editor
    aiTranslateLocales() {
      if (!this.wizard.values.translateContent.data) {
        return [];
      }
      return this.translationEnabled
        ? this.wizard.values.translateTargets.data
        : this.selectedLocales.map(({ name }) => name);
    },
    // The AI way: a job on the server works through each document in each
    // locale (see @apostrophecms/ai-localize). Progress arrives as
    // "ai-localize" bus events, and the job record is polled too, so a
    // missed event never leaves the dialog waiting
    async runAi(docs, locales) {
      try {
        const { jobId, pairs } = await apos.http.post(
          `${apos.modules['@apostrophecms/ai-localize'].action}/run`,
          {
            body: {
              mainId: this.fullDoc._id,
              docIds: docs.map(({ _id }) => _id),
              toLocales: locales,
              // "All content": each copy is replaced whole
              overwriteMain: !this.aiMode,
              overwriteRelated: this.wizard.values.relatedDocSettings.data !==
                'localizeNewRelated',
              translateLocales: this.aiTranslateLocales()
            }
          }
        );
        // The server's order: related documents first
        this.run.jobId = jobId;
        this.run.pairs = pairs.map((pair) => ({
          ...pair,
          slug: docs.find(({ _id }) => _id === pair.docId)?.slug,
          status: 'waiting'
        }));
        apos.bus.$on('ai-localize', this.onAiEvent);
        this.aiPoll = setInterval(this.pollAi, 4000);
        if (this.run.cancelled) {
          await this.cancelJob();
        }
      } catch (e) {
        for (const pair of this.run.pairs) {
          pair.status = 'failed';
          pair.message = this.$t('apostrophe:aiLocalizeStartError');
        }
        this.endRun();
      }
    },
    onAiEvent(data) {
      if (data.jobId !== this.run.jobId || !this.run.running) {
        return;
      }
      const pair = this.run.pairs[data.index];
      const names = pair && {
        title: pair.title,
        locale: this.localeLabel(pair.locale)
      };
      if (data.event === 'pair') {
        if (data.status === 'working') {
          // Up-to-date related documents are named while they are checked,
          // so the run never looks stuck, though not once it is done
          this.setPhrase(this.$t('apostrophe:localizingPhraseChecking', names));
        }
        Object.assign(pair, data);
      } else if (data.event === 'stage') {
        Object.assign(pair, data);
        this.setPhrase(data.mode === 'update'
          ? this.$t('apostrophe:localizingPhraseUpdating', {
            ...names,
            count: data.changes?.count || 0
          })
          : this.$t(data.translated
            ? 'apostrophe:localizingPhraseTranslating'
            : 'apostrophe:localizingPhraseCopying', names));
      } else if (data.event === 'message') {
        this.setPhrase(data.text);
      } else if (data.event === 'ended') {
        this.endAi(data.outcomes);
      }
    },
    // What it is doing now, unless it is stopping
    setPhrase(text) {
      if (!this.run.cancelling) {
        this.run.phrase = text;
      }
    },
    async pollAi() {
      try {
        const job = await apos.http.get(
          `${apos.modules['@apostrophecms/job'].action}/${this.run.jobId}`,
          {}
        );
        if (job.ended) {
          this.endAi(job.results?.outcomes || []);
        }
      } catch (e) {
        // The next poll or the ended event will tell
      }
    },
    endAi(outcomes) {
      if (!this.run.running) {
        return;
      }
      for (const outcome of outcomes) {
        Object.assign(this.run.pairs[outcome.index], outcome);
      }
      this.stopFollowingAi();
      this.endRun();
    },
    stopFollowingAi() {
      apos.bus.$off('ai-localize', this.onAiEvent);
      clearInterval(this.aiPoll);
    },
    localeLabel(name) {
      return this.locales.find((locale) => locale.name === name)?.label || name;
    },
    // "French", "French and German", "French, German and Spanish"
    listLabels(labels) {
      try {
        return new Intl.ListFormat(undefined, { type: 'conjunction' }).format(labels);
      } catch (e) {
        return labels.join(', ');
      }
    },
    // What the Localizing step shows (see AposI18nLocalizeProgress)
    describeRun() {
      const run = this.run;
      const t = (key, data) => this.$t(`apostrophe:${key}`, data);
      const localeLabels = [ ...new Set(run.pairs.map(({ locale }) => locale)) ]
        .map(this.localeLabel);
      // Named when one or two, counted when more: the chips name them
      const locales = localeLabels.length > 2
        ? t('localizingLocaleCount', { count: localeLabels.length })
        : this.listLabels(localeLabels);
      const main = run.pairs.find(({ related }) => !related);
      const docCount = new Set(run.pairs.map(({ docId }) => docId)).size;
      const subject = main
        ? main.title
        : t('localizingDocuments', { count: docCount });
      // Related documents already up to date are left out once it is done
      const shown = run.pairs
        .filter((pair) => !(pair.related && pair.status === 'upToDate'));
      const failed = run.pairs
        .filter(({ status }) => [ 'failed', 'incomplete' ].includes(status));
      const succeeded = run.pairs.filter(({ status }) => status === 'done');
      const view = {
        locales: localeLabels,
        phrase: {},
        trace: [],
        card: null,
        steps: null,
        help: ''
      };
      if (run.running) {
        const index = run.pairs.findIndex(({ status }) => status === 'working');
        return {
          ...view,
          phase: 'running',
          heading: t('localizingHeadingRunning', {
            title: subject,
            locales
          }),
          phrase: {
            text: run.phrase || t('localizingPhraseStarting'),
            count: run.pairs.length > 1 && index !== -1
              ? t('aiLocalizeProgressCount', {
                current: index + 1,
                total: run.pairs.length
              })
              : ''
          },
          help: t('localizingKeepOpen')
        };
      }
      if (run.blocked) {
        // Related documents chosen with it wait for it too: say so, or the
        // editor may take them for done
        const relatedCount = new Set(run.pairs
          .filter(({ related }) => related)
          .map(({ docId }) => docId)).size;
        const message = [
          t(run.blocked.parent
            ? 'localizingParentMessage'
            : 'localizingParentMessageUntitled', {
            parent: run.blocked.parent,
            locales: this.listLabels(run.blocked.locales.map(this.localeLabel))
          }),
          ...(relatedCount
            ? [ t('localizingParentRelated', { count: relatedCount }) ]
            : [])
        ];
        return {
          ...view,
          phase: 'stopped',
          heading: t('localizingHeadingNot', { title: subject }),
          card: {
            tone: 'warning',
            title: t('localizingParentTitle'),
            message: message.join(' ')
          }
        };
      }
      const partly = succeeded.length > 0;
      if (run.cancelled) {
        return {
          ...view,
          phase: 'stopped',
          heading: t(partly ? 'localizingHeadingPartly' : 'localizingHeadingNot', {
            title: subject
          }),
          card: {
            tone: 'info',
            title: t('localizingCancelledTitle'),
            message: t('localizingCancelledMessage')
          },
          steps: shown.map((pair, index) => this.planItem(pair, index))
        };
      }
      if (failed.length) {
        const message = [];
        if (failed.length === 1) {
          message.push(this.reason(failed[0]));
        }
        if (failed.some(({ writes }) => writes > 0)) {
          message.push(t('localizingFailedPartial'));
        }
        message.push(t(partly ? 'localizingFailedRestSaved' : 'localizingFailedNothingElse'));
        return {
          ...view,
          phase: 'stopped',
          heading: t(partly ? 'localizingHeadingPartly' : 'localizingHeadingNot', {
            title: subject
          }),
          card: {
            tone: partly ? 'warning' : 'error',
            title: failed.length === 1
              ? t('localizingFailedOne', {
                title: failed[0].title,
                locale: this.localeLabel(failed[0].locale)
              })
              : t('localizingFailedMany', { count: failed.length }),
            message: message.join(' ')
          },
          steps: shown.length > 1
            ? shown.map((pair, index) => this.planItem(pair, index))
            : null
        };
      }
      return {
        ...view,
        phase: 'done',
        heading: t('localizingHeadingDone', {
          title: subject,
          locales
        }),
        summary: this.runSummary(shown, locales),
        elapsed: t('localizingElapsed', {
          time: this.formatElapsed(run.endedAt - run.startedAt)
        }),
        trace: this.runTrace(shown)
      };
    },
    // One line of the plan list, for a run that stopped early
    planItem(pair, index) {
      const names = {
        title: pair.title,
        locale: this.localeLabel(pair.locale)
      };
      const status = {
        done: 'done',
        upToDate: 'done',
        failed: 'error',
        incomplete: 'error'
      }[pair.status] || 'pending';
      return {
        id: `${index}`,
        status,
        ai: pair.translated,
        label: status === 'done'
          ? this.pairLabel(pair)
          : status === 'error'
            ? this.$t('apostrophe:localizingProblem', {
              ...names,
              reason: this.reason(pair)
            })
            : this.$t('apostrophe:localizingPending', names)
      };
    },
    // Why a pair failed, briefly. A pass that stopped short ends on its last
    // progress phrase, which would read as if it were still at work
    reason(pair) {
      const text = pair.status === 'incomplete'
        ? this.$t('apostrophe:localizingIncomplete')
        : pair.message || this.$t('apostrophe:localizingFailedGeneric');
      return text.length > 300 ? `${text.slice(0, 300)}…` : text;
    },
    // What a pair did, in one line
    pairLabel(pair) {
      const names = {
        title: pair.title,
        locale: this.localeLabel(pair.locale)
      };
      if (pair.status === 'upToDate') {
        return this.$t('apostrophe:localizingTraceUpToDate', names);
      }
      if (pair.mode === 'update') {
        return this.$t(pair.translated
          ? 'apostrophe:localizingTraceUpdatedTranslated'
          : 'apostrophe:localizingTraceUpdatedCopied', {
          ...names,
          count: pair.changes?.count || 0
        });
      }
      return this.$t(pair.translated
        ? 'apostrophe:localizingTraceDocTranslated'
        : 'apostrophe:localizingTraceDocCopied', names);
    },
    // The one-line summary once it is done
    runSummary(shown, locales) {
      const t = (key, data) => this.$t(`apostrophe:${key}`, data);
      const source = this.localeLabel(this.modalData.locale);
      const main = shown.filter(({ related }) => !related);
      const related = shown.filter((pair) => pair.related && pair.status === 'done');
      const parts = [];
      if (!main.length) {
        parts.push(t('localizingSummaryDocs', {
          count: new Set(related.map(({ docId }) => docId)).size,
          locales
        }));
      } else if (main.every(({ status }) => status === 'upToDate')) {
        parts.push(t('localizingSummaryUpToDate', {
          source,
          title: main[0].title
        }));
      } else if (main.length === 1 && main[0].mode === 'update') {
        parts.push(t(main[0].translated
          ? 'localizingSummaryChangesTranslated'
          : 'localizingSummaryChangesCopied', {
          count: main[0].changes?.count || 0,
          locale: this.localeLabel(main[0].locale),
          source
        }));
      } else if (main.every(({ mode }) => mode !== 'update')) {
        parts.push(t(main.every(({ translated }) => translated)
          ? 'localizingSummaryFullTranslated'
          : 'localizingSummaryFullCopied', {
          title: main[0].title,
          locales
        }));
      } else {
        parts.push(t('localizingSummaryMixed', {
          title: main[0].title,
          locales
        }));
      }
      if (main.length && related.length) {
        parts.push(t('localizingSummaryRelated', {
          count: new Set(related.map(({ docId }) => docId)).size
        }));
      }
      return parts.join(' ');
    },
    // The trace under "Localized in …": for one document in one locale, each
    // stage; for more, a line each
    runTrace(shown) {
      const t = (key, data) => this.$t(`apostrophe:${key}`, data);
      if (shown.length !== 1) {
        return shown.map((pair, index) => ({
          id: `${index}`,
          label: this.pairLabel(pair),
          ai: pair.translated && pair.status === 'done',
          detail: pair.summary || this.changesDetail(pair)
        }));
      }
      const [ pair ] = shown;
      const names = {
        title: pair.title,
        locale: this.localeLabel(pair.locale),
        source: this.localeLabel(this.modalData.locale)
      };
      if (pair.status === 'upToDate') {
        return [ {
          id: 'compare',
          label: t('localizingTraceNoChanges', names)
        } ];
      }
      const stages = [];
      if (pair.mode === 'update') {
        stages.push({
          id: 'compare',
          label: pair.changes?.basis === 'none'
            ? t('localizingTraceCompared', names)
            : t('localizingTraceFound', {
              ...names,
              count: pair.changes?.count || 0
            }),
          detail: this.changesDetail(pair)
        });
        stages.push({
          id: 'write',
          label: t(pair.translated
            ? 'localizingTraceWroteTranslated'
            : 'localizingTraceWroteCopied', {
            ...names,
            count: pair.texts || pair.changes?.count || 0
          }),
          ai: pair.translated,
          detail: pair.summary || null
        });
      } else {
        stages.push({
          id: 'copy',
          label: t(pair.mode === 'replace'
            ? 'localizingTraceReplaced'
            : 'localizingTraceNew', names),
          detail: pair.mode === 'replace'
            ? t('localizingTraceReplacedDetail', names)
            : null
        });
        stages.push({
          id: 'write',
          label: t(pair.translated
            ? 'localizingTraceDocTranslated'
            : 'localizingTraceDocCopied', names),
          ai: pair.translated,
          detail: pair.summary || null
        });
      }
      stages.push({
        id: 'save',
        label: t('localizingTraceSaved', names),
        detail: t('localizingTraceSavedDetail')
      });
      return stages;
    },
    // The source changes a pair carried over, as the editor would name them
    changesDetail(pair) {
      const changes = pair.changes;
      if (!changes?.items?.length) {
        return null;
      }
      const labels = {
        added: 'apostrophe:versionChangeAdded',
        modified: 'apostrophe:versionChangeModified',
        deleted: 'apostrophe:versionChangeDeleted'
      };
      const lines = changes.items.map(({ change, where }) =>
        `${this.$t(labels[change] || labels.modified)}: ${where}`);
      if (changes.count > changes.items.length) {
        lines.push(this.$t('apostrophe:localizingMoreChanges', {
          count: changes.count - changes.items.length
        }));
      }
      return `${lines.join('. ')}. ${this.$t('apostrophe:localizingKeptDetail', {
        locale: this.localeLabel(pair.locale)
      })}`;
    },
    formatElapsed(ms) {
      const seconds = Math.max(1, Math.round(ms / 1000));
      return seconds < 60
        ? this.$t('apostrophe:localizingSeconds', { seconds })
        : this.$t('apostrophe:localizingMinutes', {
          minutes: Math.floor(seconds / 60),
          seconds: seconds % 60
        });
    },
    async openLocale(locale) {
      const result = await apos.http.post(`${this.moduleOptions.action}/locale`, {
        body: {
          contextDocId: this.fullDoc._id,
          locale
        }
      });
      if (result.redirectTo) {
        window.location.assign(result.redirectTo);
      }
    },
    async submitBatch() {
      const relatedTypes = this.wizard.values.toLocalize.data === 'thisDoc'
        ? []
        : this.wizard.values.relatedDocTypesToLocalize.data;
      const route = apos.modules[this.moduleName].action;

      try {
        await apos.http.post(`${route}/${this.batchOptions.action}`, {
          busy: true,
          qs: {
            aposTranslateTargets: this.wizard.values.translateTargets.data,
            aposTranslateProvider: this.wizard.values.translateProvider.data
          },
          body: {
            _ids: this.batchOptions.checked,
            relatedTypes,
            toLocales: this.selectedLocales.map(locale => locale.name),
            update: this.wizard.values.relatedDocSettings.data !== 'localizeNewRelated',
            relatedOnly: this.wizard.values.toLocalize.data === 'relatedDocsOnly',
            messages: this.batchOptions.messages
          }
        });
      } catch (error) {
        apos.notify('apostrophe:error', {
          type: 'danger',
          dismiss: true
        });
      } finally {
        this.modal.busy = false;
        this.confirm();
      }
    },
    getRelatedSchemaTypes(types) {
      const self = this;
      const allTypes = {};
      const seen = new Set();
      types.forEach(type =>
        getRelatedTypesBySchema(
          apos.modules[type].schema,
          allTypes,
          seen
        )
      );

      return Object.values(allTypes)
        .filter(type => canLocalize(type.value));

      function getRelatedTypesBySchema(schema, result = {}, seen = new Set()) {
        for (const field of schema || []) {
          if (seen.has(field._id)) {
            continue;
          }
          seen.add(field._id);

          switch (field.type) {
            case 'array':
            case 'object':
              getRelatedTypesBySchema(field.schema, result, seen);
              break;

            case 'area': {
              for (const widget of Object.keys(field.options?.widgets || {})) {
                getRelatedTypesBySchema(apos.modules[`${widget}-widget`]?.schema, result, seen);
              }
              break;
            }

            case 'relationship': {
              result[field.withType] ||= {
                value: field.withType,
                count: 0
              };
              if (!result[field.withType].count) {
                result[field.withType].label = self.plural(field.withType);
              }
              result[field.withType].count++;
              break;
            }

            default:
              break;
          }
        }
      };

      function canLocalize(type) {
        // Explicitly opt out of localization for pages as related docs.
        // This is needed only in batch mode, because we don't have the
        // full doc to check for `relatedDocument` property.
        // Without this, the "Pages" type would be shown in the UI, but
        // filtered out on the backend. The downside: if a page type explicitly
        // opts in for localization (`options.relatedDocument = true`), it won't
        // be respected in batch mode. Removing the below condition is an option
        // in the future.
        if ([ '@apostrophecms/page', '@apostrophecms/any-page-type' ].includes(type)) {
          return false;
        }
        return window.apos.modules[type].relatedDocument !== false &&
            window.apos.modules[type].localized !== false;
      }
    },
    // Get all related documents
    async getRelatedDocs(doc) {
      const status = this.wizard.busy;
      this.wizard.busy = true;
      const schema = apos.modules[doc.type].schema;
      const docs = getRelatedBySchema(doc, schema);
      if (!docs.length) {
        return [];
      }
      try {
        const result = await apos.http.post(`${apos.doc.action}/editable?aposMode=draft`, {
          body: {
            ids: docs.map(doc => doc._id)
          }
        });
        const filtered = docs.filter(doc => result.editable.includes(doc._id));
        return filtered;
      } finally {
        this.wizard.busy = status;
      }

      function getRelatedBySchema(object, schema) {
        let related = [];
        for (const field of schema) {
          if (field.type === 'array') {
            for (const value of (object[field.name] || [])) {
              related = [
                ...related,
                ...getRelatedBySchema(value, field.schema)
              ];
            }
          } else if (field.type === 'object') {
            if (object[field.name]) {
              related = [
                ...related,
                ...getRelatedBySchema(object[field.name], field.schema)
              ];
            }
          } else if (field.type === 'area') {
            for (const widget of (object[field.name]?.items || [])) {
              related = [
                ...related,
                ...getRelatedBySchema(widget, apos.modules[`${widget?.type}-widget`]?.schema || [])
              ];
            }
          } else if (field.type === 'relationship') {
            related = [
              ...related,
              ...(object[field.name] || [])
            ];
            // Stop here, don't recurse through relationships or we're soon
            // related to the entire site
          }
        }
        // Filter out doc types that opt out completely (pages should
        // never be considered "related" to other pages simply because
        // of navigation links, the feature is meant for pieces that feel more
        // like part of the document being localized) We also remove non
        // localized content like users
        return related.filter(doc => {
          return apos.modules[doc.type].relatedDocument !== false &&
            apos.modules[doc.type].localized !== false;
        });
      }
    },
    async updateRelatedDocs() {
      if (this.wizard.values.toLocalize.data === 'thisDoc') {
        return;
      }
      const status = this.wizard.busy;
      this.wizard.busy = true;
      let relatedDocs = await this.getRelatedDocs(this.fullDoc);
      this.allRelatedDocs = relatedDocs;
      this.allRelatedDocsKnown = true;
      if (
        this.wizard.values.relatedDocSettings.data === 'localizeNewRelated' &&
        !this.aiMode
      ) {
        // Find the ids that are unlocalized in at least one of the target
        // locales
        const unlocalizedIds = new Set();
        for (const locale of this.selectedLocales) {
          const existingIdsForLocale = (await apos.http.post(`${apos.modules['@apostrophecms/i18n'].action}/exist-in-locale`, {
            busy: true,
            body: {
              ids: relatedDocs.map(doc => doc._id),
              locale: locale.name
            }
          })).originalLocaleIds;
          for (const id of relatedDocs.map(doc => doc._id)) {
            if (!existingIdsForLocale.includes(id)) {
              unlocalizedIds.add(id);
            }
          }
        }
        // New documents only
        relatedDocs = relatedDocs.filter(doc => unlocalizedIds.has(doc._id));
      }
      this.relatedDocs = relatedDocs;
      this.wizard.busy = status;

      for (const doc of this.relatedDocs) {
        if (!this.docTypesSeen.includes(doc.type)) {
          this.docTypesSeen.push(doc.type);
          if (apos.modules[doc.type].relatedDocument) {
            this.wizard.values.relatedDocTypesToLocalize.data.push(doc.type);
          }
        }
      }

      this.setRelatedDocTypes();
    },
    wait(time) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, time);
      });
    },
    async retryTranslationCheck() {
      await this.checkAvailableTranslations(false);
      this.translationShowLoader = true;
      await this.wait(500);
      await this.checkAvailableTranslations(true);
      this.translationShowLoader = false;
    },
    async checkAvailableTranslations(value) {
      // Without the automatic translation module there is no provider to ask:
      // the AI flow translates into any language
      if (!value || !this.translationEnabled) {
        this.translationErrMsg = null;
        this.translationShowRetry = false;
        this.wizard.values.translateTargets.data = [];
        return;
      }
      const sourceLocale = this.modalData.locale;
      const targets = this.wizard.values.toLocales.data;

      let response;
      try {
        response = await apos.http.get(`${apos.translation.action}/languages`, {
          qs: {
            provider: this.wizard.values.translateProvider.data,
            source: [ sourceLocale ],
            target: targets.map(({ name }) => name)
          }
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('An error happened while getting available languages: ', err);
        this.wizard.values.translateTargets.data = [];
        this.translationErrMsg = this.$t('apostrophe:automaticTranslationErrMsg');
        this.translationShowRetry = true;
        return;
      }

      const unavailableSource = !response.source[0].supported;
      const unavailableTargetsLabels = response.target
        .filter(({ supported }) => !supported)
        .map(({ code }) => targets.find((locale) => locale.name === code)?.label || code);

      if (unavailableSource) {
        const sourceLabel = this.moduleOptions.locales[sourceLocale]?.label;
        this.translationErrMsg = this.$t('apostrophe:automaticTranslationSourceErrMsg', { source: sourceLabel });
        this.wizard.values.translateTargets.data = [];
        return;
      }

      if (unavailableTargetsLabels.length) {
        const isPlural = unavailableTargetsLabels.length > 1;
        this.translationErrMsg = this.$t(
          `apostrophe:automaticTranslationTargetErrMsg${isPlural ? '_plural' : ''}`,
          { targets: unavailableTargetsLabels.join(', ') }
        );
      }

      if (unavailableTargetsLabels.length >= targets.length) {
        this.wizard.values.translateTargets.data = [];
        return;
      }

      this.wizard.values.translateTargets.data = response.target
        .filter(({ supported }) => supported)
        .map(({ code }) => code);

    }
  }
};
</script>

<style lang="scss" scoped>
.apos-i18n-localize {
  @include type-base;

  :deep(.apos-modal__inner) {
    $width: 565px;
    $vertical-spacing: 95px;
    $horizontal-spacing: calc(calc(100vw - #{$width}) / 2);

    inset: $vertical-spacing $horizontal-spacing $vertical-spacing $horizontal-spacing;
    width: $width;
    height: calc(100vh - #{$vertical-spacing * 2});
  }

  :deep(.apos-modal__main--with-left-rail) {
    grid-template-columns: 30% 70%;
  }

  :deep(.apos-modal__body-inner) {
    padding: $spacing-triple $spacing-triple $spacing-double;
  }

  :deep(.apos-wizard__content .apos-modal__body-footer) {
    flex-direction: row-reverse;
    border-top: 1px solid var(--a-base-9);
  }

  :deep(.apos-busy__spinner) {
    display: inline-block;
  }
}

.apos-wizard__navigation {
  padding-top: 10px;
  border-right: 1px solid var(--a-base-9);
}

.apos-wizard__navigation__items {
  @include apos-list-reset();

  & {
    padding: $spacing-base;
  }
}

.apos-wizard__navigation__item {
  @include type-small;

  & {
    margin-bottom: $spacing-base + $spacing-half;
  }

  &.apos-is-active {
    color: var(--a-primary);
  }
}

.apos-modal__heading {
  @include type-title;

  & {
    margin: 0 0 $spacing-double;
  }
}

.apos-wizard__step {
  position: relative;
  margin: 0;
  padding: 0;
  border: none;
}

:deep(.apos-field--to-localize) {
  margin-bottom: $spacing-triple;
}

.apos-wizard__help-text {
  text-indent: -20px;
  padding-left: 20px;
  line-height: 1.25;
  font-weight: 400;
  color: var(--a-base-3);

  :deep(.material-design-icon) {
    position: relative;
    top: 3px;
    color: var(--a-base-5);
  }
}

.apos-locale-select-all {
  z-index: $z-index-default;
  position: absolute;
  right: 0;
}

.apos-locales-filter {
  margin-bottom: $spacing-base;
}

.apos-selected-locales,
.apos-locales {
  margin-top: 0;
  margin-bottom: 0;
  padding-left: 0;
  list-style-type: none;
}

.apos-selected-locales {
  margin-bottom: $spacing-base;
}

.apos-locales {
  max-height: 350px;
  overflow-y: scroll;
  font-weight: var(--a-weight-base);
}

.apos-locale-item--selected {
  display: inline-block;
  margin-bottom: 5px;

  &:not(:last-of-type) {
    margin-right: 5px;
  }
}

.apos-locale-button :deep(.apos-button) {
  font-size: var(--a-type-small);
}

.apos-locale-item {
  @include apos-transition();

  & {
    position: relative;
    padding: 12px 35px;
    line-height: 1;
    border-radius: var(--a-border-radius);
  }

  &:not(.apos-current-locale),
  &:not(.apos-disabled-locale) {
    cursor: pointer;
  }

  &:not(.apos-current-locale):hover,
  &:not(.apos-disabled-locale):hover {
    background-color: var(--a-base-10);
  }

  &:not(.apos-current-locale):active,
  &:not(.apos-disabled-locale):active {
    background-color: var(--a-base-9);
  }

  .apos-check-icon,
  .apos-current-locale-icon {
    position: absolute;
    top: 50%;
    left: 18px;
    transform: translateY(-50%);
  }

  .apos-check-icon {
    color: var(--a-primary);
    stroke: var(--a-primary);
  }

  &.apos-current-locale,
  &.apos-disabled-locale,
  .apos-current-locale-icon {
    color: var(--a-base-5);
  }

  &.apos-current-locale,
  &.apos-disabled-locale {
    font-style: italic;
  }

  .apos-locale-localized {
    position: relative;
    top: -1px;
    left: 5px;
    display: inline-block;
    width: 3px;
    height: 3px;
    border: 1px solid var(--a-base-5);
    border-radius: 50%;

    &.apos-state-is-localized {
      background-color: var(--a-success);
      border-color: var(--a-success);
    }
  }
}

.apos-wizard__step  :deep(.apos-field--related-doc-types-to-localize) {
  margin-top: $spacing-triple;
}

.apos-wizard__step {
  .apos-field__wrapper {
    margin-bottom: $spacing-double;
  }
}

.apos-wizard__field-group-heading {
  @include type-base;

  & {
    margin-bottom: $spacing-base;
    padding-bottom: $spacing-base;
    border-bottom: 1px solid var(--a-base-8);
    color: var(--a-base-3);
  }
}

.apos-wizard__field-group-heading__info {
  position: relative;
  top: 3px;
}

.apos-wizard__step-2 {
  .apos-selected-locales,
  .apos-wizard__field-group:not(:last-of-type) {
    margin-bottom: $spacing-quadruple;
  }
}

.apos-wizard__header {
  margin-top: $spacing-base;
}

.selected-list-enter-active, .selected-list-leave-active {
  @include apos-transition($duration: 0.3s);
}

.selected-list-enter, .selected-list-leave-to {
  opacity: 0;
  transform: translateY(1px);
}

.apos-modal__footer {
  width: 100%;
}

.apos-locale-name {
  text-transform: uppercase;
}

.apos-wizard__translation {
  margin-top: 30px;
}

.apos-wizard__translation-title {
  @include type-label;

  & {
    display: flex;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--a-base-8);
  }
}

.apos-wizard__translation-title-text {
  margin-left: 7px;
}

.apos-wizard__translation-error {
  @include type-label;

  & {
    color: var(--a-danger);
  }
}

.apos-wizard__translation-spinner {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.apos-wizard__scope--below {
  margin-top: $spacing-triple;
}

// The progress view grows as it runs: bound the modal's row so the body
// scrolls on its own and the footer with the Done button stays in view
.apos-i18n-localize--progress :deep(.apos-modal__main) {
  grid-template-rows: minmax(0, 1fr);
}
</style>
