<template>
  <AposModal
    class="apos-wizard apos-i18n-localize"
    :class="{
      'apos-wizard-busy': wizard.busy,
      'apos-i18n-localize--progress': ai.jobId
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
            >
              {{ section.title }}
            </li>
          </ul>
        </template>
        <template #footer>
          <div
            v-if="!ai.jobId"
            class="apos-modal__footer"
          >
            <AposButton
              type="default"
              label="apostrophe:cancel"
              :modifiers="[ 'block' ]"
              @click="cancel"
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

          <div
            v-if="ai.jobId"
            class="apos-ai-localize"
            data-apos-test="aiLocalizeProgress"
          >
            <div
              class="apos-ai-localize__status"
              :class="{ 'apos-ai-localize__status--running': ai.running }"
              role="status"
            >
              <AposSpinner
                v-if="ai.running"
                class="apos-ai-localize__status-spinner"
                weight="heavy"
              />
              <div class="apos-ai-localize__status-text">
                <p class="apos-ai-localize__heading">
                  {{ $t(ai.running
                    ? (ai.stopping
                      ? 'apostrophe:aiLocalizeStopping'
                      : 'apostrophe:aiLocalizeProgressHeading')
                    : (ai.stopped
                      ? 'apostrophe:aiLocalizeStoppedHeading'
                      : 'apostrophe:aiLocalizeFinishedHeading')) }}
                </p>
                <p
                  v-if="ai.running && currentPair"
                  class="apos-ai-localize__current"
                >
                  {{ $t('apostrophe:aiLocalizeWorkingOn', {
                    title: currentPair.title,
                    locale: localeLabel(currentPair.locale)
                  }) }}
                  <template v-if="ai.pairs.length > 1">
                    · {{ $t('apostrophe:aiLocalizeProgressCount', {
                      current: ai.pairs.indexOf(currentPair) + 1,
                      total: ai.pairs.length
                    }) }}
                  </template>
                </p>
              </div>
            </div>
            <ul class="apos-ai-localize__pairs">
              <li
                v-for="(pair, index) in ai.pairs"
                :key="index"
                class="apos-ai-localize__pair"
                :class="`apos-ai-localize__pair--${statusClass(pair.status)}`"
              >
                <span class="apos-ai-localize__pair-name">
                  <span class="apos-ai-localize__pair-title">{{ pair.title }}</span>
                  <span class="apos-ai-localize__pair-locale">
                    {{ localeLabel(pair.locale) }}
                    <template v-if="pair.related">
                      · {{ $t(singular(pair.type)) }}
                    </template>
                  </span>
                </span>
                <span class="apos-ai-localize__pair-status">
                  <AposSpinner
                    v-if="pair.status === 'working'"
                    class="apos-ai-localize__spinner"
                  />
                  {{ $t(statusLabel(pair.status)) }}
                </span>
                <AposButton
                  v-if="canOpen(pair)"
                  class="apos-ai-localize__open"
                  type="quiet"
                  :modifiers="[ 'inline' ]"
                  label="apostrophe:aiLocalizeOpen"
                  @click="openLocale(pair.locale)"
                />
                <p
                  v-if="pair.summary || pair.message"
                  class="apos-ai-localize__pair-note"
                >
                  {{ pair.summary || pair.message }}
                </p>
              </li>
            </ul>
            <ol
              ref="aiLog"
              class="apos-ai-localize__log"
              aria-live="polite"
              data-apos-test="aiLocalizeLog"
            >
              <li
                v-for="(entry, index) in ai.log"
                :key="index"
                class="apos-ai-localize__entry"
                :class="`apos-ai-localize__entry--${entry.kind}`"
              >
                {{ entry.text }}
              </li>
            </ol>
          </div>
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
        <template
          v-if="ai.jobId"
          #footer
        >
          <AposButton
            v-if="ai.running"
            type="danger"
            :label="ai.stopping ? 'apostrophe:aiLocalizeStopping' : 'apostrophe:aiLocalizeStop'"
            :disabled="ai.stopping"
            data-apos-test="aiLocalizeStop"
            @click="stopAi"
          />
          <AposButton
            v-else
            type="primary"
            label="apostrophe:close"
            @click="confirm"
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
      // An AI localization run, once started: its pairs of document and
      // locale with their status, and the progress the agent reports
      ai: {
        jobId: null,
        pairs: [],
        log: [],
        running: false,
        stopping: false,
        stopped: false
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
    // The pair being worked on, for the status line
    currentPair() {
      return this.ai.pairs?.find(({ status }) => status === 'working') || null;
    },
    aiMode() {
      return this.aiScopeAvailable && this.wizard.values.scope.data === 'onlyNew';
    },
    // The AI flow can translate on its own, so it offers translation with or
    // without the automatic translation module; the classic copy needs the
    // module
    translationAvailable() {
      return this.translationEnabled || this.aiMode;
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
    'ai.log.length'() {
      const scroller = this.aiScroller();
      const following = !scroller ||
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 48;
      this.$nextTick(() => {
        const scroller = this.aiScroller();
        if (following && scroller) {
          scroller.scrollTop = scroller.scrollHeight;
        }
      });
    },
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
        this.fullDoc = await apos.http.get(
          `${this.action}/${this.doc._id}`,
          {
            busy: true
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
    async cancel() {
      if (!this.modal.busy && await this.mayClose()) {
        this.modal.showModal = false;
        this.$emit('modal-result', Boolean(this.ai.jobId));
      }
    },
    async close() {
      if (!this.modal.busy && await this.mayClose()) {
        this.modal.showModal = false;
        this.$emit('modal-result', this.ai.jobId ? true : null);
      }
    },
    // Closing the dialog while AI localization runs stops it, once the
    // editor confirms
    async mayClose() {
      if (!this.ai.running) {
        return true;
      }
      const stop = await apos.confirm({
        heading: 'apostrophe:aiLocalizeStopHeading',
        description: 'apostrophe:aiLocalizeStopDescription',
        affirmativeLabel: 'apostrophe:aiLocalizeStopAndClose',
        negativeLabel: 'apostrophe:aiLocalizeKeepGoing'
      });
      if (!stop) {
        return false;
      }
      await this.stopAi();
      this.stopFollowingAi();
      return true;
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
    async submit() {
      if (this.isBatchMode) {
        return this.submitBatch();
      }
      if (this.aiMode) {
        return this.submitAi();
      }
      let docs = [];
      const notifications = [];
      this.wizard.busy = true;

      if (this.wizard.values.toLocalize.data !== 'relatedDocsOnly') {
        docs.push(this.fullDoc);
      }
      if (this.wizard.values.toLocalize.data !== 'thisDoc') {
        for (const type of this.relatedDocTypes) {
          const ofType = this.relatedDocs.filter(doc => doc.type === type.value);
          docs = [
            ...docs,
            ...ofType
          ];
        }
      }
      for (const doc of docs) {
        if (
          (doc._id !== this.fullDoc._id) &&
          !this.wizard.values.relatedDocTypesToLocalize.data.includes(doc.type)
        ) {
          continue;
        }
        this.modal.busy = true;
        for (const locale of this.selectedLocales) {
          try {
            const result = await apos.http.post(`${apos.modules[doc.type].action}/${doc._id}/localize`, {
              body: {
                toLocale: locale.name,
                update: (doc._id === this.fullDoc._id) || !(this.wizard.values.relatedDocSettings.data === 'localizeNewRelated')
              },
              qs: {
                aposTranslateTargets: this.wizard.values.translateTargets.data,
                aposTranslateProvider: this.wizard.values.translateProvider.data
              },
              busy: true
            });

            notifications.push({
              type: 'success',
              locale,
              docTypeLabel: this.singular(doc.type),
              doc,
              result,
              relationship: doc._id === this.fullDoc._id
            });

            if (this.targetLocale && this.shouldRedirect) {
              // Ask for the redirect URL, this way it still works if we
              // need to carry a session across hostnames
              const result = await apos.http.post(`${this.moduleOptions.action}/locale`, {
                body: {
                  contextDocId: apos.adminBar.context && apos.adminBar.context._id,
                  locale: locale.name
                }
              });
              if (result.redirectTo) {
                window.location.assign(result.redirectTo);
              }
            }

          } catch (e) {
            // Status code 409 (conflict) means an existing document
            // we opted not to overwrite
            if (e.status !== 409) {
              const detail = e?.body?.data?.parentNotLocalized
                ? this.$t('apostrophe:parentNotLocalized')
                : e?.body?.data?.detail ? this.$t(e.body.data.detail) : null;
              notifications.push({
                type: 'error',
                locale,
                docTypeLabel: this.singular(doc.type),
                doc,
                relationship: doc._id === this.fullDoc._id,
                detail
              });
            }
          }
        }
      }

      if (notifications.some(({ type }) => type === 'error')) {
        this.modal.busy = false;
        this.close();

        await apos.report(
          {
            heading: 'apostrophe:localizingReportHeading',
            description: 'apostrophe:localizingReportDesc',
            footerMessageDanger: 'apostrophe:localizingReportHeading',
            items: notifications,
            headers: [
              {
                name: 'doc.aposDocId',
                label: '_id',
                format: 'last:5'
              },
              {
                name: 'docTypeLabel',
                label: 'apostrophe:type',
                sortable: true
              },
              {
                name: 'locale.label',
                label: 'apostrophe:locale',
                sortable: true
              },
              {
                name: 'relationship',
                label: 'apostrophe:relationship',
                format: 'yesno',
                visibility: 'export',
                sortable: true
              },
              {
                name: 'doc.title',
                label: 'apostrophe:title',
                width: '20%',
                sortable: true
              },
              {
                name: 'detail',
                label: 'apostrophe:details',
                width: '20%'
              }
            ]
          }
        );
      } else {
        await this.notifyLocalized(
          notifications.filter(({ type }) => type === 'success')
        );
      }

      // Prevent flashing of the UI if the request returns quickly
      setTimeout(() => {
        this.modal.busy = false;
        this.confirm();
      }, 250);
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
    // Start an AI localization run and follow it in place of the wizard. The
    // server works through each document in each locale; progress arrives
    // as "ai-localize" bus events, and the job record is polled too, so a
    // missed event never leaves the dialog waiting
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
    async submitAi() {
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
      this.wizard.busy = true;
      try {
        const { jobId, pairs } = await apos.http.post(
          `${apos.modules['@apostrophecms/ai-localize'].action}/run`,
          {
            busy: true,
            body: {
              mainId: this.fullDoc._id,
              docIds: docs.map(({ _id }) => _id),
              toLocales: this.selectedLocales.map(({ name }) => name),
              overwriteRelated: this.wizard.values.relatedDocSettings.data !==
                'localizeNewRelated',
              translateLocales: this.aiTranslateLocales()
            }
          }
        );
        this.ai = {
          jobId,
          pairs: pairs.map((pair) => ({
            ...pair,
            status: 'waiting'
          })),
          log: [],
          running: true,
          stopping: false,
          stopped: false
        };
        apos.bus.$on('ai-localize', this.onAiEvent);
        this.aiPoll = setInterval(this.pollAi, 4000);
      } catch (e) {
        await apos.notify('apostrophe:aiLocalizeStartError', {
          type: 'danger',
          dismiss: true
        });
      } finally {
        this.wizard.busy = false;
      }
    },
    onAiEvent(data) {
      if (data.jobId !== this.ai.jobId) {
        return;
      }
      const pair = this.ai.pairs[data.index];
      if (data.event === 'pair') {
        if (data.status === 'working') {
          this.ai.log.push({
            kind: 'pair',
            text: this.$t('apostrophe:aiLocalizeWorkingOn', {
              title: pair.title,
              locale: this.localeLabel(pair.locale)
            })
          });
        } else {
          // How the pair ended, unless the agent's own summary says it
          this.ai.log.push({
            kind: [ 'failed', 'incomplete' ].includes(data.status) ? 'error' : 'tool',
            text: this.$t(this.statusLabel(data.status)) +
              (data.message ? ` — ${data.message}` : '')
          });
        }
        Object.assign(pair, data);
      } else if (data.event === 'message') {
        this.ai.log.push({
          kind: 'message',
          text: data.text
        });
      } else if (data.event === 'tool') {
        this.ai.log.push({
          kind: data.error ? 'error' : 'tool',
          text: this.$t(data.label, {
            count: data.count,
            locale: this.localeLabel(data.locale)
          }) + (data.error ? ` — ${data.error}` : '')
        });
      } else if (data.event === 'ended') {
        this.endAi(data.outcomes, data.stopped);
      }
    },
    async pollAi() {
      try {
        const job = await apos.http.get(
          `${apos.modules['@apostrophecms/job'].action}/${this.ai.jobId}`,
          {}
        );
        if (job.ended) {
          this.endAi(job.results?.outcomes || [], job.status === 'canceled');
        }
      } catch (e) {
        // The next poll or the ended event will tell
      }
    },
    endAi(outcomes, stopped) {
      if (!this.ai.running) {
        return;
      }
      for (const outcome of outcomes) {
        Object.assign(this.ai.pairs[outcome.index], outcome);
      }
      for (const pair of this.ai.pairs) {
        if ([ 'waiting', 'working' ].includes(pair.status)) {
          pair.status = 'stopped';
        }
      }
      this.ai.running = false;
      this.ai.stopping = false;
      this.ai.stopped = Boolean(stopped || this.ai.stopped);
      this.stopFollowingAi();
      this.notifyAi();
    },
    // The same notifications the classic flow ends with: what was localized,
    // with a button to open it, and what failed
    async notifyAi() {
      const localized = this.ai.pairs.filter(({ status }) => [ 'done', 'upToDate' ].includes(status));
      const failed = this.ai.pairs.filter(({ status }) => [ 'failed', 'incomplete' ].includes(status));
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
      if (failed.length) {
        await apos.notify('apostrophe:localizingNotificationDanger', {
          type: 'danger',
          icon: 'translate-icon',
          interpolate: { count: failed.length },
          dismiss: true
        });
      }
    },
    async stopAi() {
      if (!this.ai.running || this.ai.stopping) {
        return;
      }
      this.ai.stopping = true;
      this.ai.stopped = true;
      try {
        await apos.http.post(
          `${apos.modules['@apostrophecms/job'].action}/${this.ai.jobId}/cancel`,
          { body: {} }
        );
      } catch (e) {
        this.ai.stopping = false;
      }
    },
    // The element the progress view scrolls in. Never scrollIntoView: it
    // also scrolls the modal's clipped containers, shifting the whole dialog
    aiScroller() {
      let el = this.$refs.aiLog?.parentElement;
      while (el && el !== document.body) {
        if ([ 'auto', 'scroll' ].includes(getComputedStyle(el).overflowY)) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    },
    stopFollowingAi() {
      apos.bus.$off('ai-localize', this.onAiEvent);
      clearInterval(this.aiPoll);
    },
    localeLabel(name) {
      return this.locales.find((locale) => locale.name === name)?.label || name;
    },
    statusClass(status) {
      return status.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    },
    statusLabel(status) {
      return {
        waiting: 'apostrophe:aiLocalizeStatusWaiting',
        working: 'apostrophe:aiLocalizeStatusWorking',
        done: 'apostrophe:aiLocalizeStatusDone',
        upToDate: 'apostrophe:aiLocalizeStatusUpToDate',
        stopped: 'apostrophe:aiLocalizeStatusStopped',
        incomplete: 'apostrophe:aiLocalizeStatusIncomplete',
        failed: 'apostrophe:aiLocalizeStatusFailed'
      }[status] || status;
    },
    // The page the dialog was opened on can be opened in a locale it was
    // localized into, the way the classic flow offers once it is done
    canOpen(pair) {
      return !this.ai.running && !pair.related &&
        [ 'done', 'upToDate' ].includes(pair.status) &&
        this.fullDoc._id === apos.adminBar.context?._id;
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
// scrolls on its own and the footer with the Stop button stays in view
.apos-i18n-localize--progress :deep(.apos-modal__main) {
  grid-template-rows: minmax(0, 1fr);
}

.apos-ai-localize {
  display: flex;
  flex-direction: column;
  gap: $spacing-double;
}

// Stays in view while the log scrolls under it
.apos-ai-localize__status {
  z-index: $z-index-default;
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  padding: $spacing-double;
  border: 1px solid var(--a-base-9);
  gap: $spacing-double;
  border-radius: var(--a-border-radius);
  background-color: var(--a-background-primary);
  // Covers the body's top padding, which the log would show through
  box-shadow: 0 -20px 0 var(--a-background-primary);
}

.apos-ai-localize__status--running {
  border-color: var(--a-primary-transparent-50);
  // Opaque, since the log scrolls under it
  background:
    linear-gradient(var(--a-primary-transparent-10), var(--a-primary-transparent-10)),
    var(--a-background-primary);
}

.apos-ai-localize__status-spinner {
  flex-shrink: 0;
}

.apos-ai-localize__status-text {
  min-width: 0;
}

.apos-ai-localize__heading {
  @include type-large;

  & {
    margin: 0;
  }
}

.apos-ai-localize__current {
  @include type-small;

  & {
    margin: $spacing-half 0 0;
    color: var(--a-base-3);
  }
}

.apos-ai-localize__pairs {
  @include apos-list-reset();

  & {
    display: flex;
    flex-direction: column;
    gap: $spacing-base;
  }
}

.apos-ai-localize__pair {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: $spacing-half $spacing-base;
  align-items: center;
  padding: $spacing-base;
  border: 1px solid var(--a-base-9);
  border-radius: var(--a-border-radius);
}

.apos-ai-localize__pair-name {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.apos-ai-localize__pair-title {
  @include type-label;

  & {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.apos-ai-localize__pair-locale {
  @include type-small;

  & {
    color: var(--a-base-3);
  }
}

.apos-ai-localize__pair-status {
  @include type-small;

  & {
    display: flex;
    gap: $spacing-half;
    align-items: center;
    color: var(--a-base-3);
  }
}

.apos-ai-localize__pair--done .apos-ai-localize__pair-status,
.apos-ai-localize__pair--up-to-date .apos-ai-localize__pair-status {
  color: var(--a-success);
}

.apos-ai-localize__pair--failed .apos-ai-localize__pair-status,
.apos-ai-localize__pair--incomplete .apos-ai-localize__pair-status {
  color: var(--a-danger);
}

.apos-ai-localize__pair-note {
  @include type-small;

  & {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--a-base-2);
  }
}

.apos-ai-localize__log {
  @include apos-list-reset();

  & {
    padding: $spacing-base;
    border-radius: var(--a-border-radius);
    background-color: var(--a-base-10);
  }
}

.apos-ai-localize__entry {
  @include type-small;

  & {
    padding: $spacing-half 0;
    color: var(--a-base-1);
    line-height: 1.4;
  }
}

.apos-ai-localize__entry--pair {
  @include type-label;

  & {
    margin-top: $spacing-base;
  }

  &:first-child {
    margin-top: 0;
  }
}

.apos-ai-localize__entry--tool {
  color: var(--a-base-3);
}

.apos-ai-localize__entry--error {
  color: var(--a-danger);
}
</style>
