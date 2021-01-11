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
            v-if="confirmContent.icon" class="apos-confirm__custom-logo"
            :src="confirmContent.icon" alt=""
          >
          <AposLogoIcon
            v-else-if="confirmContent.icon !== false" class="apos-confirm__logo"
          />
          <h2
            v-if="confirmContent.heading"
            class="apos-confirm__heading"
          >
            {{ confirmContent.heading }}
          </h2>
          <p
            class="apos-confirm__description"
            v-if="confirmContent.description"
          >
            {{ confirmContent.description }}
          </p>
          <div class="apos-confirm__btns">
            <AposButton
              v-if="mode !== 'alert'"
              class="apos-confirm__btn"
              :label="confirmContent.negativeLabel || 'Cancel'" @click="cancel"
            />
            <AposButton
              class="apos-confirm__btn"
              :label="affirmativeLabel"
              @click="confirm"
              :type="confirmContent.theme || 'primary'"
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
    mode: {
      type: String,
      default: 'confirm'
    },
    confirmContent: {
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
      }
    };
  },
  computed: {
    affirmativeLabel() {
      if (this.mode === 'confirm') {
        return this.confirmContent.affirmativeLabel || 'Confirm';
      } else {
        return this.confirmContent.affirmativeLabel || 'OK';
      }
    }
  },
  async mounted() {
    this.modal.active = true;
  },
  methods: {
    confirm() {
      this.modal.showModal = false;
      this.$emit('modal-result', true);
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
  width: 430px;
  height: auto;
  text-align: center;
}

/deep/ .apos-modal__overlay {
  .apos-modal + .apos-confirm & {
    display: block;
  }
}

/deep/ .apos-modal__body {
  padding: 60px;
}

.apos-confirm__logo,
.apos-confirm__custom-logo {
  height: 40px;
  margin-bottom: $spacing-base;
}

.apos-confirm__heading {
  @include type-title;
  line-height: var(--a-line-tall);
  margin: 0;
}

.apos-confirm__description {
  @include type-large;
  line-height: var(--a-line-tallest);
}

.apos-confirm__btns {
  display: flex;
  justify-content: center;
  margin-top: 30px;
}

.apos-confirm__btn {
  & + & {
    margin-left: $spacing-double;
  }
}
</style>
