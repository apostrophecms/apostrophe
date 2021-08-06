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
            {{ wizard.values }}
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
              <div>Search locales</div>
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
import InformationIcon from 'vue-material-design-icons/Information.vue';

export default {
  name: 'AposI18nLocalize',
  components: { InformationIcon },
  props: {
    id: {
      required: true,
      type: String
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
      wizard: {
        step: 0,
        sections: [
          { title: this.$t('apostrophe:selectContent') },
          { title: this.$t('apostrophe:selectLocales') },
          { title: this.$t('apostrophe:confirmSettings') }
        ],
        values: {
          toLocalize: { data: 'thisDocumentAndRelated' }
        }
      }
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.i18n;
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
      console.log(this.wizard.values);
    },
    hasError() {
      return false;
    },
    isStep(number) {
      return this.wizard.step === number;
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
</style>
