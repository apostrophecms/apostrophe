<template>
  <AposModal
    class="apos-widget-editor"
    :modal="modal" :modal-title="moduleTitle"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
    @esc="cancel" @no-modal="$emit('safe-close')"
  >
    <template #breadcrumbs>
      <AposModalBreadcrumbs :items="breadcrumbs" />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div class="apos-widget-editor__body">
            <AposSchema
              :schema="schema" :doc="myDoc"
              @input="update"
            />
          </div>
        </template>
      </AposModalBody>
    </template>
    <template #footer>
      <AposButton
        type="default" label="Cancel"
        @click="cancel"
      />
      <AposButton
        type="primary" @click="save"
        :label="saveLabel"
      />
    </template>
  </AposModal>
</template>

<script>
import AposModalParentMixin from 'Modules/@apostrophecms/modal/mixins/AposModalParentMixin';

export default {
  name: 'AposWidgetEditor',
  mixins: [AposModalParentMixin],
  props: {
    breadcrumbs: {
      type: Array,
      default: function () {
        return [];
      }
    },
    typeLabel: {
      type: String,
      default: ''
    },
    doc: {
      type: Object,
      required: true
    },
    schema: {
      type: Array,
      required: true
    }
  },
  emits: ['safe-close', 'save'],
  data() {
    return {
      myDoc: { ...this.doc },
      modal: {
        title: `Edit ${this.typeLabel}`,
        active: false,
        type: 'slide',
        showModal: false
      }
    };
  },
  computed: {
    moduleTitle () {
      return `Manage ${this.typeLabel}`;
    },
    saveLabel: function () {
      if (this.typeLabel) {
        return `Save ${this.typeLabel}`;
      }
      return 'Save';
    }
  },
  async mounted() {
    // TODO: Get data here.
    this.modal.active = true;
  },
  methods: {
    update(name, value) {
      this.myDoc[name] = value.data;
    },
    save() {
      this.$emit('save', this.myDoc);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-widget-editor /deep/ .apos-modal__inner {
    max-width: 458px;
  }
</style>
