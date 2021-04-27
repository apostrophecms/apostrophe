<template>
  <AposModal
    :modal="modal" class="apos-confirm"
    v-on="mode !== 'alert' ? { 'esc': cancel } : null"
    @no-modal="$emit('safe-close')"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
  >
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <img
            v-if="content.icon" class="apos-confirm__custom-logo"
            :src="content.icon" alt=""
          >
          <AposLogoIcon
            v-else-if="content.icon !== false" class="apos-confirm__logo"
          />
          <h2
            v-if="content.heading"
            class="apos-confirm__heading"
          >
            {{ content.heading }}
          </h2>
          <p
            class="apos-confirm__description"
            v-if="content.description"
          >
            {{ content.description }}
          </p>
          <div v-if="content.form" class="apos-confirm__schema">
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
              class="apos-confirm__btn"
              :label="content.negativeLabel || 'Cancel'" @click="cancel"
            />
            <AposButton
              class="apos-confirm__btn"
              :label="affirmativeLabel"
              @click="confirm"
              :type="content.theme || 'primary'"
              :disabled="isDisabled"
            />
          </div>
          <p
            class="apos-confirm__note"
            v-if="content.note"
          >
            {{ content.note }}
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
    }
  },
  emits: [ 'safe-close', 'confirm-response', 'modal-result' ],
  data() {
    return {
      modal: {
        title: '',
        active: false,
        type: 'overlay',
        showModal: false,
        disableHeader: true,
        trapFocus: true
      },
      formValues: null
    };
  },
  computed: {
    affirmativeLabel() {
      if (this.mode === 'confirm') {
        return this.content.affirmativeLabel || 'Confirm';
      } else {
        return this.content.affirmativeLabel || 'OK';
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
    confirm() {
      this.modal.showModal = false;
      const result = this.content.form ? this.formValues : true;
      this.$emit('modal-result', result);
    },
    async cancel() {
      this.modal.showModal = false;
      this.$emit('modal-result', false);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-confirm {
  z-index: $z-index-modal;
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/deep/ .apos-modal__inner {
  top: auto;
  right: auto;
  bottom: auto;
  left: auto;
  width: 550px;
  height: auto;
  text-align: center;
}

/deep/ .apos-modal__overlay {
  .apos-modal + .apos-confirm & {
    display: block;
  }
}

/deep/ .apos-modal__body {
  padding: 40px 60px;
}

/deep/ .apos-modal__body-main {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.apos-confirm__logo,
.apos-confirm__custom-logo {
  height: 35px;
  margin-bottom: $spacing-double;
}

.apos-confirm__heading {
  @include type-title;
  line-height: var(--a-line-tall);
  margin: 0;
}

.apos-confirm__description {
  @include type-base;
  max-width: 370px;
  line-height: var(--a-line-tallest);
}

.apos-confirm__note {
  @include type-small;
  margin-top: $spacing-double;
  line-height: var(--a-line-tall);
  max-width: 355px;
  color: var(--a-base-2);
}

.apos-confirm__schema {
  margin-top: $spacing-base;
}

/deep/ .apos-schema .apos-field {
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
</style>
