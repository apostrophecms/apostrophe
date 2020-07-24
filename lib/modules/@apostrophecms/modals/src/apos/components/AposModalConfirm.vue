<template>
  <AposModal
    :modal="modal" class="apos-confirm"
    @esc="cancel" @no-modal="$emit('safe-close')"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
  >
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <img
            v-if="confirmContent.icon" class="apos-confirm__icon"
            :src="confirmContent.icon" alt=""
          >
          <AposLogo
            v-else-if="confirmContent.icon !== false" class="apos-confirm__icon"
          />
          <h2
            v-if="confirmContent.heading"
            class="apos-confirm__heading apos-heading"
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
              class="apos-confirm__btn"
              :label="confirmContent.negativeLabel || 'Cancel'" @click="cancel"
            />
            <AposButton
              class="apos-confirm__btn"
              :label="confirmContent.affirmativeLabel || 'Confirm'"
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
import AposModalParentMixin from '../../mixins/AposModalParentMixin';
import AposModal from '../modal/AposModal.vue';
import AposModalBody from './../modal/AposModalBody.vue';
import AposButton from '../button/AposButton.vue';
import AposLogo from './AposLogo.vue';

export default {
  components: {
    AposModal,
    AposModalBody,
    AposButton,
    AposLogo
  },
  mixins: [AposModalParentMixin],
  props: {
    confirmContent: {
      type: Object,
      required: true
    }
  },
  emits: ['safe-close', 'confirm'],
  data() {
    return {
      modal: {
        title: '',
        active: false,
        type: 'overlay',
        showModal: false
      }
    };
  },
  methods: {
    confirm() {
      this.modal.showModal = false;
      this.$emit('confirm');
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-confirm {
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
  width: 420px;
  height: auto;
  text-align: center;
}

/deep/ .apos-modal__body {
  padding: 60px;
}

.apos-confirm__icon {
  width: 60px;
  height: 60px;
}

.apos-confirm__description {
  font-size: map-get($font-sizes, default);
  font-weight: 400;
}

.apos-confirm__btns {
  margin-top: 30px;
}

.apos-confirm__btn {
  & + & {
    margin-left: $spacing-double;
  }
}
</style>
