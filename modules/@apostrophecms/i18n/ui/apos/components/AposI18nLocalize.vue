<template>
  <AposModal
    class="apos-wizard apos-i18n-localize"
    :class="{ 'apos-wizard-busy': wizard.busy }"
    :modal="modal"
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
          <div class="apos-modal__footer">
            <AposButton
              type="default"
              label="apostrophe:cancel"
              :modifiers="[ 'block' ]"
              @click="close"
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

          <form class="apos-wizard__form" @submit.prevent>
            <fieldset
              v-if="isStep('selectContent')"
              class="apos-wizard__step apos-wizard__step-select-content"
            >
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
                        label: 'apostrophe:localizeNewRelated',
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
                <p v-else class="apos-wizard__help-text">
                  <AposIndicator
                    class="apos-wizard__help-text__icon"
                    icon="lightbulb-on-icon"
                    icon-color="var(--a-success)"
                    :icon-size="16"
                  />
                  {{ $t('apostrophe:noNewRelatedDocuments') }}
                </p>
              </div>
              <div v-if="translationEnabled" class="apos-wizard__translation">
                <p class="apos-wizard__translation-title">
                  <AposTranslationIndicator :size="18" />
                  <span class="apos-wizard__translation-title-text">
                    {{ $t('apostrophe:automaticTranslationSettings') }}
                  </span>
                </p>
                <AposCheckbox
                  v-model="wizard.values.translateContent.data"
                  :field="{ name: 'translate' }"
                  :choice="{
                    value: wizard.values.translateContent.data,
                    label: $t('apostrophe:automaticTranslationCheckbox')
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
        <template #footer>
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
      required: true,
      type: Object
    },
    locale: {
      required: false,
      type: Object,
      default: null
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
              // replicated related docs
              const hasRelated = this.allRelatedDocs.length > 0;
              if (!hasRelated) {
                this.wizard.values.toLocalize.data = 'thisDoc';
              }
              return hasRelated;
            }
          },
          selectLocales: {
            title: this.$t('apostrophe:selectLocales'),
            filter: '',
            if() {
              return !this.locale;
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

              // If they choose related docs only, they must check at least one related doc type to continue
              return (toLocalize.data !== 'relatedDocsOnly') ||
                this.relatedDocTypes
                  .find(({ value }) => relatedDocTypesToLocalize.data.includes(value));
            }
          }
        },
        values: {
          toLocalize: { data: 'thisDocAndRelated' },
          toLocales: { data: this.locale ? [ this.locale ] : [] },
          relatedDocSettings: { data: 'localizeNewRelated' },
          relatedDocTypesToLocalize: { data: [] },
          translateContent: { data: false },
          translateTargets: { data: [] },
          translateProvider: { data: apos.translation.providers[0]?.name || null }
        }
      },
      fullDoc: this.doc,
      relatedDocs: [],
      // Includes those that aren't new, even if we are only expressing
      // interest in new docs
      allRelatedDocs: [],
      allRelatedDocsKnown: false,
      docTypesSeen: [],
      searchField: {
        label: this.$t('apostrophe:searchLocales'),
        placeholder: `${this.$t('apostrophe:searchLocales')}...`
      },
      searchValue: {
        value: '',
        error: false
      },
      toLocalizeChoices: [
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
      translationEnabled: apos.modules['@apostrophecms/translation'].enabled,
      translationErrMsg: null,
      translationShowRetry: false,
      translationShowLoader: false
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.i18n;
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
      return this.selectedLocales.length === this.locales.filter(locale => !this.isCurrentLocale(locale) && this.canEditLocale(locale)).length;
    },
    relatedDocTypes() {
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
      return Object.values(types);
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
      const result = Object.entries(this.wizard.sections).filter(([ _, section ]) => {
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
      this.updateRelatedDocs();
    },
    'wizard.values.toLocalize.data'() {
      this.updateRelatedDocs();
    },
    async 'wizard.values.translateContent.data'(value) {
      await this.checkAvailableTranslations(value);
    },
    selectedLocales() {
      this.updateRelatedDocs();
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
  async mounted() {
    this.modal.active = true;
    this.wizard.busy = true;
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
  },
  methods: {
    close() {
      if (!this.modal.busy) {
        this.modal.showModal = false;
      }
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
      return window.apos.i18n.locale === locale.name;
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
            await apos.http.post(`${apos.modules[doc.type].action}/${doc._id}/localize`, {
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
              doc
            });

            if (this.locale) {
              // Ask for the redirect URL, this way it still works if we
              // need to carry a session across hostnames
              const result = await apos.http.post(`${apos.i18n.action}/locale`, {
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
              notifications.push({
                type: 'error',
                locale,
                doc,
                detail: e?.body?.data?.parentNotLocalized &&
                  'apostrophe:parentNotLocalized'
              });
            }
          }
        }
      }

      if (notifications.some(({ type }) => type === 'error')) {
        this.modal.busy = false;
        this.close();

        await apos.alert(
          {
            icon: false,
            heading: 'apostrophe:localizingBusy',
            description: 'apostrophe:thereWasAnIssueLocalizing',
            body: {
              component: 'AposI18nLocalizeErrors',
              props: {
                notifications
              }
            },
            affirmativeLabel: 'apostrophe:close'
          }
        );

      } else {
        for (const item of notifications) {
          await apos.notify('apostrophe:localized', {
            type: 'success',
            interpolate: {
              type: this.$t(this.singular(item.doc.type)),
              title: item.doc.title,
              locale: item.locale.name
            },
            dismiss: true
          });
        }
      }

      // Prevent flashing of the UI if the request returns quickly
      setTimeout(() => {
        this.modal.busy = false;
        this.close();
      }, 250);
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
        // of navigation links, the feature is meant for pieces that feel more like
        // part of the document being localized)
        // We also remove non localized content like users
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
      if (this.wizard.values.relatedDocSettings.data === 'localizeNewRelated') {
        // Find the ids that are unlocalized in at least one of the target locales
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
      if (!value) {
        this.translationErrMsg = null;
        this.translationShowRetry = false;
        this.wizard.values.translateTargets.data = [];
        return;
      }
      const [ sourceLocale ] = this.doc.aposLocale.split(':');
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
</style>
