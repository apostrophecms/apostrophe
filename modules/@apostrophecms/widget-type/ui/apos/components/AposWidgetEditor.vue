<template>
  <AposModal
    class="apos-widget-editor"
    :modal="modal" :modal-title="editLabel"
    @inactive="modal.active = false" @show-modal="modal.showModal = true"
    @esc="confirmAndCancel" @no-modal="$emit('safe-close')"
  >
    <template #breadcrumbs>
      <AposModalBreadcrumbs :items="breadcrumbs" />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div class="apos-widget-editor__body">
            <AposSchema
              :schema="schema"
              :value="widgetInfo"
              @input="updateWidgetInfo"
            />
          </div>
        </template>
      </AposModalBody>
    </template>
    <template #footer>
      <AposButton
        type="default" label="Cancel"
        @click="confirmAndCancel"
      />
      <AposButton
        type="primary" @click="save"
        :label="saveLabel"
        :disabled="widgetInfo.hasErrors"
      />
    </template>
  </AposModal>
</template>

<script>
import AposModalModifiedMixin from 'Modules/@apostrophecms/modal/mixins/AposModalModifiedMixin';
import cuid from 'cuid';

export default {
  name: 'AposWidgetEditor',
  mixins: [ AposModalModifiedMixin ],
  props: {
    type: {
      required: true,
      type: String
    },
    breadcrumbs: {
      type: Array,
      default: function () {
        return [];
      }
    },
    options: {
      required: true,
      type: Object
    },
    value: {
      required: false,
      type: Object,
      default() {
        return {};
      }
    }
  },
  emits: [ 'safe-close', 'insert', 'update' ],
  data() {
    return {
      id: this.value && this.value._id,
      widgetInfo: {
        data: { ...this.value },
        hasErrors: false
      },
      modal: {
        title: this.editLabel,
        active: false,
        type: 'slide',
        showModal: false
      }
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.modules[apos.area.widgetManagers[this.type]];
    },
    typeLabel() {
      return this.moduleOptions.label;
    },
    editLabel() {
      if (this.moduleOptions.editLabel) {
        return this.moduleOptions.editLabel;
      } else {
        return `Edit ${this.typeLabel}`;
      }
    },
    saveLabel() {
      if (this.moduleOptions.saveLabel) {
        return this.moduleOptions.saveLabel;
      } else {
        return `Save ${this.typeLabel}`;
      }
    },
    schema() {
      return this.moduleOptions.schema;
    }
  },
  async mounted() {
    this.modal.active = true;
  },
  methods: {
    updateWidgetInfo(value) {
      this.widgetInfo = value;
      this.modified = true;
    },
    save() {
      const widget = this.widgetInfo.data;
      if (!widget.type) {
        widget.type = this.type;
      }
      if (!this.id) {
        widget._id = cuid();
        this.$emit('insert', widget);
      } else {
        widget._id = this.id;
        this.$emit('update', widget);
      }
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-widget-editor /deep/ .apos-modal__inner {
    max-width: 458px;
  }
</style>
