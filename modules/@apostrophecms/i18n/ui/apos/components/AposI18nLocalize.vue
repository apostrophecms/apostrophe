<template>
  <AposModal
    class="apos-i18n-localize"
    :modal="modal" :modal-title="$t('apostrophe:localizeContent')"
    @esc="close"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @no-modal="$emit('safe-close')"
  >
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div>The doc id is {{ doc._id }}</div>
        </template>
      </AposModalBody>
    </template>
    <template #footer>
      <AposButton
        type="default"
        label="Cancel"
        @click="close"
      />
      <AposButton
        type="primary"
        label="apostrophe:localize"
      />
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
    }
  },
  emits: [ 'safe-close', 'modal-result' ],
  data() {
    return {
      modal: {
        active: false,
        type: 'slide',
        showModal: false
      }
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.i18n;
    },
    action() {
      return this.doc.slug.startsWith('/') ? apos.page.action : apos.modules[this.doc.type].action;
    }
  },
  async mounted() {
    this.modal.active = true;
  },
  methods: {
    close() {
      this.modal.showModal = false;
    }
  }
};
</script>

<style lang="scss" scoped>
</style>
