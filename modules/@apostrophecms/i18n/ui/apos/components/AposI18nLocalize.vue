<template>
  <AposModal
    class="apos-wizard apos-i18n-localize"
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
            v-for="(section, index) in wizard.sections"
            :key="section.title"
            @click="goTo(index)"
            class="apos-wizard__navigation-item"
            :class="{ 'apos-state-active': isStep(index) }"
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

          <form class="apos-wizard__form" @submit.prevent="submit">
            <fieldset
              v-if="isStep(0)"
              class="apos-wizard__step apos-wizard__step-0"
            >
              <AposInputRadio
                :field="{
                  name: 'toLocalize',
                  label: 'apostrophe:whatContentToLocalize',
                  choices: [
                    {
                      value: 'thisDocument',
                      label: $t('apostrophe:thisDocument'),
                    },
                    {
                      value: 'thisDocumentAndRelated',
                      label: $t('apostrophe:thisDocumentAndRelated'),
                    },
                    {
                      value: 'relatedDocumentsOnly',
                      label: $t('apostrophe:relatedDocumentsOnly'),
                    },
                  ],
                }"
                :value="wizard.values.toLocalize"
                v-model="wizard.values.toLocalize"
              />
              <p class="apos-wizard__help-text">
                <InformationIcon :size="16" />
                {{ $t('apostrophe:relatedDocumentsAre') }}
              </p>
            </fieldset>

            <fieldset
              v-if="isStep(1)"
              class="apos-wizard__step apos-wizard__step-1"
            >
              <label for="localeFilter" class="apos-local-filter-label">
                {{ $t('apostrophe:searchLocales') }}
              </label>
              <button @click.prevent="selectAll" class="apos-locale-select-all">
                {{ $t('apostrophe:selectAll') }}
              </button>
              <input
                v-model="wizard.sections[1].filter"
                type="text"
                name="localeFilter"
                class="apos-locales-filter"
                placeholder="Search Locales"
              >
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
                      class="apos-default-icon"
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
              v-if="isStep(2)"
              class="apos-wizard__step apos-wizard__step-2"
            >
              <div>Confirm Settings</div>
            </fieldset>
          </form>
        </template>
        <template #footer>
          <AposButton
            v-if="isStep(wizard.sections.length - 1)"
            type="primary"
            :disabled="hasError()"
            label="apostrophe:localizeContent"
          />
          <AposButton
            v-else
            type="primary"
            @click="goTo(wizard.step + 1)"
            icon-after="arrow-right-icon"
            :disabled="hasError()"
            :icon-size="12"
            label="apostrophe:next"
          />
          <AposButton
            v-if="!isStep(0)"
            type="default"
            @click="goTo(wizard.step - 1)"
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
    }
  },
  emits: [ 'safe-close', 'modal-result' ],
  data() {
    return {
      modal: {
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
      wizard: {
        step: 0,
        sections: [
          { title: this.$t('apostrophe:selectContent') },
          {
            title: this.$t('apostrophe:selectLocales'),
            filter: ''
          },
          { title: this.$t('apostrophe:confirmSettings') }
        ],
        values: {
          toLocalize: { data: 'thisDocumentAndRelated' },
          toLocales: { data: [] }
        }
      }
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
      return this.locales.filter(({ name, label }) => {
        const matches = term =>
          term
            .toLowerCase()
            .includes(this.wizard.sections[1].filter.toLowerCase());

        return matches(name) || matches(label);
      });
    },
    selectedLocales() {
      return this.wizard.values.toLocales.data;
    }
  },
  async mounted() {
    this.modal.active = true;
  },
  methods: {
    close() {
      this.modal.showModal = false;
    },
    goTo(number) {
      this.wizard.step = number;
    },
    hasError() {
      return false;
    },
    isStep(number) {
      return this.wizard.step === number;
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
      // TODO: Integrate this when PRO-1870 is merged.
      return (
        (window.apos.page &&
          window.apos.page.page &&
          window.apos.page.page.aposLocale.includes(locale.name)) ||
        false
      );
    },
    selectAll() {
      this.wizard.values.toLocales.data = [ ...this.locales ];
    },
    selectLocale(locale) {
      if (!this.isSelected(locale) || !this.isCurrentLocale(locale)) {
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
    localeClasses(locale) {
      if (this.isSelected(locale)) {
        return {
          'apos-active': true
        };
      } else if (this.isCurrentLocale(locale)) {
        return {
          'apos-default': true
        };
      } else {
        return {};
      }
    },
    submit() {
      console.log('Submitting...');
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
  cursor: pointer;

  &:hover {
    background-color: var(--a-base-10);
  }

  .apos-check-icon,
  .apos-default-icon {
    position: absolute;
    top: 50%;
    left: 20px;
    transform: translateY(-50%);
  }

  .apos-check-icon {
    color: var(--a-primary);
    stroke: var(--a-primary);
  }

  &.apos-active {
    .active {
      opacity: 1;
    }
  }

  &.apos-default,
  .apos-default-icon {
    color: var(--a-base-5);
  }

  &.apos-default {
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
</style>
