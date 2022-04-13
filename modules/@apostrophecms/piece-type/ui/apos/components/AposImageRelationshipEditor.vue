<template>
  <AposModal
    class="apos-doc-editor"
    :modal="modal"
    :modal-title="modalTitle"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="confirmAndCancel"
    @no-modal="$emit('safe-close')"
  >
    <template #secondaryControls>
      <AposButton
        type="default"
        label="apostrophe:cancel"
        @click="confirmAndCancel"
      />
    </template>
    <template #primaryControls>
      <AposButton
        type="primary"
        label="apostrophe:update"
        :disabled="docFields.hasErrors"
        @click="submit"
      />
    </template>
    <template #leftRail>
      <AposModalRail>
        <div class="apos-schema">
          <div class="apos-schema__aligned-fields">
            <div class="apos-schema__field">
              <label for="">
                W
              </label>
              <input
                class="apos-input apos-input--text"
                type="number"
                min="1"
              >
            </div>
            <div class="apos-schema__field">
              <label for="">
                H
              </label>
              <input
                class="apos-input apos-input--text"
                type="number"
                min="1"
              >
            </div>
          </div>
        </div>
        <!-- TODO: Make grouping and tabs working for relationships -->
        <!-- <AposModalTabs
          v-if="tabs.length"
          :current="currentTab"
          :tabs="tabs"
          :errors="fieldErrors"
          @select-tab="switchPane"
        /> -->
      </AposModalRail>
    </template>
    <template #main>
      <div class="apos-image-cropper__container">
        <AposImageCropper
          :img-infos="imgInfos"
          :doc-fields="docFields"
          @change="updateDocFields"
        />
      </div>
    </template>
  </AposModal>
</template>

<script>
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';
import cuid from 'cuid';

export default {
  name: 'AposImageRelationshipEditor',
  mixins: [
    AposModifiedMixin
  ],
  props: {
    schema: {
      type: Array,
      default: () => ([])
    },
    value: {
      type: Object,
      default: null
    },
    title: {
      type: String,
      required: true
    },
    imgInfos: {
      type: Object,
      required: true
    },
    id: {
      type: String,
      required: true
    }
  },
  emits: [ 'modal-result', 'safe-close' ],
  data() {
    return {
      original: this.value,
      docFields: this.setDocFields(this.value),
      modal: {
        active: false,
        type: 'overlay',
        showModal: true
      },
      modalTitle: {
        key: 'apostrophe:editImageRelationshipTitle',
        title: this.title
      },
      groups: [],
      tabs: [],
      currentTab: null,
      visibleSchema: [],
      alignedFields: [ 'width', 'height' ]
    };
  },
  async mounted() {
    this.modal.active = true;

    this.setVisibleSchema();
    this.setNestedSchema();

    // this.setGroups();
    // this.setTabs();
    // this.setFields();
  },
  methods: {
    async submit() {
      await apos.http.post(`${apos.attachment.action}/crop`, {
        body: {
          _id: this.id,
          crop: this.docFields.data
        }
      });
      this.$emit('modal-result', this.docFields.data);
      this.modal.showModal = false;
    },
    updateDocFields(value, repopulateFields = false) {
      if (value.hasErrors) {
        return;
      }

      this.docFields.data = {
        ...this.docFields.data,
        ...value.data,
        ...repopulateFields && { _id: cuid() }
      };
    },
    isModified() {
      return detectDocChange(this.schema, this.original, this.docFields.data);
    },
    setGroups() {
      this.groups = this.schema.reduce((acc, {
        name, type, group
      }) => {
        const newField = {
          name,
          type
        };

        const { fields = [], schema = [] } = acc[group.name] || {};

        return {
          ...acc,
          [group.name]: {
            label: group.label,
            fields: [
              ...fields,
              newField.name
            ],
            schema: [
              ...schema,
              newField
            ]
          }
        };
      }, {});
    },
    setTabs() {
      this.tabs = Object.entries(this.groups).reduce((acc, [ name, { label } ]) => {
        return [
          ...acc,
          {
            name,
            label
          }
        ];
      }, []);

      this.currentTab = this.tabs[0].name;
    },
    setDocFields (original) {
      const doc = original ||
        Object.fromEntries(
          this.schema.map(field => ([ field.name, null ]))
        );

      return {
        data: {
          ...Object.entries(doc).reduce((acc, [ name, value ]) => {
            return {
              ...acc,
              [name]: typeof value === 'number' ? value : (this.imgInfos[name] || null)
            };
          }, {})
        },
        hasErrors: false
      };
    },
    setVisibleSchema () {
      const visibleSchema = this.schema.filter((field) => field.label);

      this.visibleSchema = this.formatSizeFields(visibleSchema);
    },
    setNestedSchema () {
      const notAlignedFields = this.visibleSchema
        .filter((field) => !this.alignedFields.includes(field.name));

      const sizeFields = this.schema
        .filter((field) => this.alignedFields.includes(field.name));

      const alignedField = {
        name: 'cropFields',
        type: 'alignedFields',
        label: 'Crop Size (px)',
        fields: this.formatSizeFields(sizeFields)
      };

      this.nestedSchema = [
        ...notAlignedFields,
        alignedField
      ];
    },
    formatSizeFields(fields) {
      return fields.map((field) => {
        if (!this.alignedFields.includes(field.name)) {
          return field;
        }

        return {
          ...field,
          max: this.imgInfos[field.name]
        };
      });
    },
    switchPane(name) {
      this.currentTab = name;
    }
  }
};
</script>

<style scoped lang="scss" >
.apos-schema {
  margin: 30px 15px 0;

  &__aligned-fields {
    display: flex;
    justify-content: space-between;
    flex-direction: row;

  }
}

.apos-image-cropper__container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 10%;
}
</style>
