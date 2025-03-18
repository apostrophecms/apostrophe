<template>
  <AposModal
    :modal="modal"
    class="apos-confirm"
    :class="{ 'apos-confirm--tiny': options.tiny }"
    v-on="mode !== 'alert' ? { esc: close } : null"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @ready="ready"
  >
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <AposIndicator
            v-if="options.hasCloseButton"
            icon="close-icon"
            class="apos-confirm__close-btn"
            :icon-size="20"
            @click="close"
          />
          <img
            v-if="content.icon"
            class="apos-confirm__custom-logo"
            :src="content.icon"
            alt=""
          >
          <AposLogoIcon
            v-else-if="content.icon !== false"
            class="apos-confirm__logo"
          />
          <h2
            v-if="content.heading"
            class="apos-confirm__heading"
          >
            {{ localize(content.heading) }}
          </h2>
          <p
            v-if="content.description"
            class="apos-confirm__description"
          >
            {{ localize(content.description) }}
          </p>
          <Component
            :is="content.body.component"
            v-if="content.body"
            v-bind="content.body.props"
          />
          <div
            v-if="content.form"
            class="apos-confirm__schema"
          >
            <AposSchema
              v-if="formValues"
              v-model="formValues"
              :schema="content.form.schema"
              :trigger-validation="true"
            />
          </div>
          <div class="apos-confirm__btns">
            <AposButton
              v-if="mode !== 'alert'"
              :attrs="{'data-apos-focus-priority': mode !== 'alert' ? true : null}"
              class="apos-confirm__btn"
              :label="content.negativeLabel || 'apostrophe:cancel'"
              @click="cancel"
            />
            <AposButton
              ref="confirm"
              :attrs="{'data-apos-focus-priority': mode === 'alert' ? true : null}"
              class="apos-confirm__btn"
              :label="affirmativeLabel"
              :type="content.theme || 'primary'"
              :disabled="isDisabled"
              @click="confirm"
            />
          </div>
          <p
            v-if="content.note"
            class="apos-confirm__note"
          >
            {{ localize(content.note) }}
          </p>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
export default {
  props: {
    mode: {
      type: String,
      default: 'confirm'
    },
    content: {
      type: Object,
      required: true
    },
    callbackName: {
      type: String,
      default: ''
    },
    options: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  emits: [ 'confirm-response', 'modal-result' ],
  data() {
    return {
      modal: {
        title: '',
        active: false,
        type: 'overlay',
        showModal: false,
        disableHeader: true
      },
      formValues: null
    };
  },
  computed: {
    affirmativeLabel() {
      if (this.mode === 'confirm') {
        return (
          this.localize(this.content.affirmativeLabel) || this.$t('Confirm')
        );
      } else {
        return this.localize(this.content.affirmativeLabel) || this.$t('OK');
      }
    },
    isDisabled() {
      if (!this.formValues) {
        return false;
      }
      let disabled = false;
      if (this.content.form.schema) {
        this.content.form.schema.forEach(field => {
          if (field.required && !this.formValues.data[field.name]) {
            disabled = true;
          }
        });
      }
      return disabled;
    }
  },
  async mounted() {
    // Get the data. This will be more complex in actuality.
    this.modal.active = true;
    if (this.content.form) {
      this.formValues = this.content.form.value;
    }
  },
  methods: {
    close() {
      this.modal.showModal = false;
      this.$emit('modal-result', null);
    },
    ready() {
      this.$refs.confirm.$el.querySelector('button').focus();
    },
    confirm() {
      this.modal.showModal = false;
      const result = this.content.form ? this.formValues : true;
      this.$emit('modal-result', result);
    },
    async cancel() {
      this.modal.showModal = false;
      this.$emit('modal-result', false);
    },
    localize(s) {
      return this.options.localize === false
        ? s
        : this.$t(s, this.options.interpolate || {});
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-confirm {
  z-index: $z-index-modal;
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  :deep(.apos-modal__inner) {
    inset: auto;
    max-width: 700px;
    height: auto;
    text-align: center;
  }

  :deep(.apos-modal__overlay) {
    .apos-modal + .apos-confirm & {
      display: block;
    }
  }

  :deep(.apos-modal__body) {
    padding: 60px;
  }

  :deep(.apos-modal__body-main) {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
}

.apos-confirm--tiny :deep(.apos-modal__body) {
  padding: 40px;
}

.apos-confirm__logo,
.apos-confirm__custom-logo {
  height: 35px;
  margin-bottom: $spacing-double;
}

.apos-confirm__heading {
  @include type-title;

  & {
    line-height: var(--a-line-tall);
    margin: 0;
  }
}

.apos-confirm__description {
  @include type-base;

  & {
    max-width: 370px;
    line-height: var(--a-line-tallest);
  }
}

.apos-confirm__note {
  @include type-small;

  & {
    margin-top: $spacing-double;
    line-height: var(--a-line-tall);
    max-width: 355px;
    color: var(--a-base-2);
  }
}

.apos-confirm__schema {
  margin-top: $spacing-base;
}

:deep(.apos-schema .apos-field) {
  margin-bottom: $spacing-base;
}

.apos-confirm__btns {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}

.apos-confirm__btn {
  & + & {
    margin-left: $spacing-double;
  }
}

.apos-confirm__close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  cursor: pointer;
}
</style>
