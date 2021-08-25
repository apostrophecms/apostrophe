<template>
  <AposModal
    class="apos-wizard apos-i18n-localize"
    :class="{ 'apos-wizard-busy': wizard.busy }"
    :modal="modal"
    @esc="close"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @no-modal="$emit('safe-close')"
  >
    <template #leftRail>
      <AposModalBody class="apos-wizard__navigation">
        <template #bodyMain>
          <button
            v-for="section in visibleSections"
            :disabled="!completedPrevious(section.name)"
            :key="section.title"
            @click="goTo(section.name)"
            class="apos-wizard__navigation-item"
            :class="{ 'apos-state-active': isStep(section.name) }"
          >
            {{ section.title }}
          </button>
        </template>
        <template #footer>
          <div class="apos-modal__footer">
            <AposButton
              type="default"
              label="apostrophe:cancel"
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
                :field="{
                  name: 'toLocalize',
                  label: 'apostrophe:whatContentToLocalize',
                  choices: toLocalizeChoices
                }"
                v-model="wizard.values.toLocalize"
              />
              <p
                v-if="relatedDocTypes.length > 0"
                class="apos-wizard__help-text"
              >
                <InformationIcon :size="16" />
                {{ $t('apostrophe:relatedDocumentsAre') }}
              </p>
            </fieldset>

            <fieldset
              v-if="isStep('selectLocales')"
              class="apos-wizard__step apos-wizard__step-select-locales"
            >
              <label for="localeFilter" class="apos-local-filter-label">
                {{ $t('apostrophe:searchLocales') }}
              </label>
              <button @click.prevent="selectAll" class="apos-locale-select-all">
                {{ $t('apostrophe:selectAll') }}
              </button>
              <input
                v-model="wizard.sections.selectLocales.filter"
                type="text"
                name="localeFilter"
                class="apos-locales-filter"
                :placeholder="$t('apostrophe:searchLocales')"
              />
              <ul class="apos-selected-locales">
                <li
                  v-for="locale in selectedLocales"
                  :key="locale.name"
                  class="apos-locale-item--selected"
                >
                  <AposButton
                    type="primary"
                    @click.prevent="removeLocale(locale)"
                    class="apos-locale-button"
                    icon="close-icon"
                    :icon-size="12"
                    :label="locale.label"
                  />
                </li>
              </ul>
              <ul class="apos-locales">
                <li
                  v-for="locale in filteredLocales"
                  :key="locale.name"
                  class="apos-locale-item"
                  :class="localeClasses(locale)"
                  @click="selectLocale(locale)"
                >
                  <span class="apos-locale">
                    <FlareIcon
                      v-if="isCurrentLocale(locale) && !isSelected(locale)"
                      class="apos-current-locale-icon"
                      title="Default locale"
                      :size="12"
                    />
                    <CheckIcon
                      v-if="isSelected(locale)"
                      class="apos-check-icon"
                      title="Currently selected locale"
                      :size="12"
                    />
                    {{ locale.label }}
                    <span
                      class="apos-locale-localized"
                      :class="{
                        'apos-state-is-localized': isLocalized(locale),
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
                  v-for="locale in selectedLocales"
                  :key="locale.name"
                  class="apos-locale-item--selected"
                >
                  <span class="apos-locale-to-localize">{{
                    locale.label
                  }}</span>
                </li>
              </ul>

              <div
                v-if="wizard.values.toLocalize.data !== 'thisDoc'"
                class="apos-wizard__field-group"
              >
                <p class="apos-wizard__field-group-heading">
                  {{ $t('apostrophe:relatedDocumentSettings') }}
                  <span v-apos-tooltip.top="tooltips.relatedDocSettings"
                    ><InformationIcon :size="14"
                  /></span>
                </p>

                <AposInputRadio
                  :field="{
                    name: 'relatedDocSettings',
                    choices: [
                      {
                        value: 'localizeNewRelated',
                        label: 'Localize new related documents',
                      },
                      {
                        value: 'localizeAllRelatedAndOverwriteExisting',
                        label:
                          'Localize all related documents and overwrite existing documents',
                        tooltip: tooltips.localizeAllAndOverwrite,
                      },
                    ],
                  }"
                  v-model="wizard.values.relatedDocSettings"
                />

                <AposInputCheckboxes
                  v-if="relatedDocTypes.length > 0"
                  :field="relatedDocTypesField"
                  v-model="wizard.values.relatedDocTypesToLocalize"
                />
                <p v-else class="apos-wizard__field-group-heading">
                  {{ $t('apostrophe:noNewRelatedDocuments') }}
                </p>
              </div>
            </fieldset>
          </form>
        </template>
        <template #footer>
          <AposButton
            v-if="isLastStep()"
            type="primary"
            label="apostrophe:localizeContent"
            :disabled="!complete()"
            @click="submit"
          />
          <AposButton
            v-else
            type="primary"
            @click="goToNext()"
            icon-after="arrow-right-icon"
            :disabled="!complete()"
            :icon-size="12"
            label="apostrophe:next"
          />
          <AposButton
            v-if="!isFirstStep()"
            type="default"
            @click="goToPrevious()"
            label="apostrophe:back"
          />
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import CheckIcon from 'vue-material-design-icons/Check.vue';
import FlareIcon from 'vue-material-design-icons/Flare.vue';
import InformationIcon from 'vue-material-design-icons/Information.vue';

export default {
  name: 'AposI18nLocalize',
  components: {
    CheckIcon,
    FlareIcon,
    InformationIcon
  },
  props: {
    doc: {
      required: true,
      type: Object
    },
    locale: {
      required: false,
      type: Object
    }
  },
  emits: [ 'safe-close', 'modal-result' ],
  data() {
    const result = {
      modal: {
        busy: false,
        busyTitle: this.$t('apostrophe:localizingContent'),
        disableHeader: true,
        active: false,
        showModal: false
      },
      locales: Object.entries(window.apos.i18n.locales).map(
        ([ locale, options ]) => {
          return {
            name: locale,
            label: options.label || locale
          };
        }
      ),
      localized: {},
      tooltips: {
        relatedDocSettings: this.$t('apostrophe:relatedDocumentsAre'),
        localizeAllAndOverwrite: this.$t('apostrophe:ifRelatedDocumentExists')
      },
      wizard: {
        step: 'selectContent',
        sections: {
          selectContent: {
            title: this.$t('apostrophe:selectContent'),
            if() {
              if (!this.fullDoc) {
                // We can't rule it out yet
                return true;
              }
              // Must show step one as long as some related docs
              // exist, as the user might opt in step three
              // to express an interest in previously
              // replicated related docs
              return this.allRelatedDocs.length > 0;
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
              // If they choose related docs only, they must check at least one related doc type to continue
              return (this.wizard.values.toLocalize.data !== 'relatedDocsOnly') || this.relatedDocTypes.find(type => this.wizard.values.relatedDocTypesToLocalize.data.includes(type.value));
            }
          }
        },
        values: {
          toLocalize: { data: 'thisDocAndRelated' },
          toLocales: { data: this.locale ? [this.locale] : [] },
          relatedDocSettings: { data: 'localizeNewRelated' },
          relatedDocTypesToLocalize: { data: [] }
        }
      },
      fullDoc: this.doc,
      relatedDocs: [],
      // Includes those that aren't new, even if we are only expressing
      // interest in new docs
      allRelatedDocs: [],
      docTypesSeen: []
    };
    return result;
  },
  watch: {
    'wizard.values.relatedDocSettings.data'() {
      this.updateRelatedDocs();
    },
    'wizard.values.toLocalize.data'() {
      this.updateRelatedDocs();
    },
    selectedLocales() {
      this.updateRelatedDocs();
    }
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
      return this.locales.filter(({ name, label }) => {
        const matches = term =>
          term
            .toLowerCase()
            .includes(this.wizard.sections.selectLocales.filter.toLowerCase());

        return matches(name) || matches(label);
      });
    },
    selectedLocales() {
      return this.wizard.values.toLocales.data;
    },
    toLocalizeChoices() {
      return [
        {
          value: 'thisDoc',
          label: 'apostrophe:thisDocument',
        },
        {
          value: 'thisDocAndRelated',
          label: 'apostrophe:thisDocumentAndRelated',
        },
        {
          value: 'relatedDocsOnly',
          label: 'apostrophe:relatedDocumentsOnly',
        }
      ];
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
          if (!this.docTypesSeen.includes(doc.type)) {
            this.docTypesSeen.push(doc.type);
            if (apos.modules[doc.type].relatedDocument) {
              this.wizard.values.relatedDocTypesToLocalize.data.push(doc.type);
            }
          }
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
        name: 'relatedDocTypesToLocalize',
        label: 'apostrophe:relatedDocTypesToLocalize',
        choices: this.relatedDocTypes
      };
    },
    visibleSections() {
      const self = this;
      const result = Object.entries(this.wizard.sections).filter(([ name, section ]) => {
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
    },
    relatedDocypesField() {
      return {
        name: 'relatedDocTypesToLocalize',
        label: 'Related document types to localize',
        choices: relatedDocTypes,
      };
    }
  },
  async mounted() {
    this.modal.active = true;
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
    this.wizard.step = this.visibleStepNames[0];
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
    isSelected(locale) {
      return this.wizard.values.toLocales.data.some(
        ({ name }) => name === locale.name
      );
    },
    isLocalized(locale) {
      return !!this.localized[locale.name];
    },
    selectAll() {
      this.wizard.values.toLocales.data = [ ...this.locales ];
    },
    selectLocale(locale) {
      if (!this.isSelected(locale) && !this.isCurrentLocale(locale)) {
        this.wizard.values.toLocales.data.push(locale);
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
    async submit() {
      let docs = [];
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
        if ((doc._id !== this.fullDoc._id) && !this.wizard.values.relatedDocTypesToLocalize.data.includes(doc.type)) {
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
              busy: true
            });
            await apos.notify('apostrophe:localized', {
              type: 'success',
              interpolate: {
                type: this.$t(this.singular(doc.type)),
                title: doc.title,
                locale: locale.name
              },
              dismiss: true
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
              await apos.notify(e?.body?.data?.parentNotLocalized ? 'apostrophe:parentNotLocalized' : 'apostrophe:notLocalized', {
                type: 'error',
                interpolate: {
                  type: this.$t(this.singular(doc.type)),
                  title: doc.title,
                  locale: locale.name
                }
              });
            }
          }
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
      const schema = apos.modules[doc.type].schema;
      const docs = getRelatedBySchema(doc, schema);
      if (!docs.length) {
        return [];
      }
      const result = await apos.http.post(`${apos.doc.action}/editable?aposMode=draft`, {
        body: {
          ids: docs.map(doc => doc._id)
        }
      });
      const filtered = docs.filter(doc => result.editable.includes(doc._id));
      return filtered;

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
        return related.filter(doc => apos.modules[doc.type].relatedDocument !== false);
      }
    },
    async updateRelatedDocs() {
      if (this.wizard.values.toLocalize.data === 'thisDoc') {
        return;
      }
      let relatedDocs = await this.getRelatedDocs(this.fullDoc);
      this.allRelatedDocs = relatedDocs;
      if (this.wizard.values.relatedDocSettings.data === 'localizeNewRelated') {
        // Find the ids that are unlocalized in at least one of the target locales
        let unlocalizedIds = new Set();
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
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-i18n-localize {
  @include type-base;

  ::v-deep .apos-modal__inner {
    $width: 565px;
    $vertical-spacing: 95px;
    $horizontal-spacing: calc(calc(100vw - #{$width}) / 2);
    top: $vertical-spacing;
    right: $horizontal-spacing;
    bottom: $vertical-spacing;
    left: $horizontal-spacing;
    height: calc(100vh - #{$vertical-spacing * 2});
    width: $width;
  }

  ::v-deep .apos-modal__main--with-left-rail {
    grid-template-columns: 30% 70%;
  }

  ::v-deep .apos-modal__body-inner {
    padding: 30px 30px 20px 30px;
  }

  ::v-deep .apos-wizard__content .apos-modal__body-footer {
    flex-direction: row-reverse;
    border-top: 1px solid var(--a-base-9);
  }

  ::v-deep .apos-busy__spinner {
    display: inline-block;
  }
}

.apos-wizard__navigation {
  padding-top: 10px;
  border-right: 1px solid var(--a-base-9);
}

.apos-wizard__navigation-item {
  display: block;
  padding: 0;
  text-align: left;
  border: none;
  background: transparent;
  cursor: pointer;

  &.apos-state-active {
    color: var(--a-primary);
  }

  &:not(:last-of-type) {
    margin-bottom: $spacing-double;
  }
}

.apos-modal__heading {
  @include type-title;
  margin: 0 0 30px 0;
}

.apos-wizard__step {
  padding: 0;
  margin: 0;
  border: none;
}

::v-deep .apos-field--toLocalize {
  margin-bottom: 30px;
}

.apos-wizard__help-text {
  text-indent: -20px;
  padding-left: 20px;
  line-height: 1.25;

  ::v-deep .material-design-icon {
    position: relative;
    top: 3px;
    color: var(--a-base-5);
  }
}

.apos-local-filter-label {
  font-size: var(--a-type-large);
}

.apos-locale-select-all {
  float: right;
  padding: 0;
  font-size: var(--a-type-base);
  color: var(--a-primary);
  background: none;
  border: 0;
}

.apos-locales-filter {
  box-sizing: border-box;
  width: 100%;
  padding: 20px;
  margin-top: 10px;
  margin-bottom: 10px;
  font-size: 14px;
  border-top: 0;
  border-right: 0;
  border-bottom: 1px solid var(--a-base-9);
  border-left: 0;
  color: var(--a-text-primary);
  background-color: var(--a-base-10);
  border-top-right-radius: var(--a-border-radius);
  border-top-left-radius: var(--a-border-radius);

  &::placeholder {
    color: var(--a-base-4);
    font-style: italic;
  }

  &:focus {
    outline: none;
  }
}

.apos-selected-locales,
.apos-locales {
  list-style-type: none;
  padding-left: 0;
  margin-top: 0;
  margin-bottom: 0;
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

.apos-locale-button ::v-deep .apos-button {
  padding: 10px;
  font-size: var(--a-type-small);
}

.apos-locale-item {
  position: relative;
  padding: 12px 35px;
  line-height: 1;

  &:not(.apos-current-locale) {
    cursor: pointer;
  }

  &:not(.apos-current-locale):hover {
    background-color: var(--a-base-10);
  }

  .apos-check-icon,
  .apos-current-locale-icon {
    position: absolute;
    top: 50%;
    left: 20px;
    transform: translateY(-50%);
  }

  .apos-check-icon {
    color: var(--a-primary);
    stroke: var(--a-primary);
  }

  &.apos-current-locale,
  .apos-current-locale-icon {
    color: var(--a-base-5);
  }

  &.apos-current-locale {
    font-style: italic;
  }

  .apos-locale-localized {
    position: relative;
    top: -1px;
    display: inline-block;
    height: 5px;
    width: 5px;
    border: 1px solid var(--a-base-5);
    border-radius: 3px;

    &.apos-state-is-localized {
      background-color: var(--a-success);
      border-color: var(--a-success);
    }
  }
}

.apos-wizard__step {
  .apos-field__wrapper:not(:last-of-type) {
    margin-bottom: $spacing-triple;
  }
}

.apos-wizard__field-group-heading {
  padding-bottom: $spacing-base;
  margin-bottom: $spacing-base;
  font-size: var(--a-type-large);
  font-weight: 600;
  color: var(--a-base-3);
  border-bottom: 1px solid var(--a-base-8);
}

.apos-wizard__step-2 {
  .apos-selected-locales,
  .apos-wizard__field-group:not(:last-of-type) {
    margin-bottom: $spacing-quadruple;
  }
}

.apos-locale-to-localize {
  @include type-small;
  display: inline-block;
  position: relative;
  overflow: hidden;
  padding: 10px 20px;
  border: 1px solid var(--a-primary-dark-10);
  color: var(--a-white);
  border-radius: var(--a-border-radius);
  background: var(--a-primary);
  text-decoration: none;
}
</style>
