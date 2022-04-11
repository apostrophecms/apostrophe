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
        <!-- <div class="apos-schema">
          <div class="apos-schema__crop-fields">
            <AposInputString
              v-model="docFields.data.width"
              :field="fields.width"
            />
          </div>
        </div> -->
        <div class="apos-schema__container">
          <AposSchema
            v-model="docFields"
            :schema="visibleSchema"
            :nested-schema="nestedSchema"
            :utility-rail="false"
            @input="updateDocFields"
          />
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
// import { klona } from 'klona';
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
    }
  },
  emits: [ 'modal-result', 'safe-close' ],
  data() {
    return {
      docReady: false,
      original: this.value,
      docFields: this.setDocFields(this.value),
      fieldErrors: {},

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
      currentTab: null,
      tabs: [],
      fields: {},
      visibleSchema: [],
      alignedFields: [ 'width', 'height' ]
    };
  },
  async mounted() {
    this.modal.active = true;
    this.docReady = true;

    this.setVisibleSchema();
    this.setNestedSchema();

    // this.setGroups();
    // this.setTabs();
    // this.setFields();
  },
  methods: {
    async submit() {
      this.$emit('modal-result', this.docFields.data);
      this.modal.showModal = false;
    },
    updateDocFields(value) {
      if (value.hasErrors) {
        return;
      }

      // this.updateFieldState(value.fieldState);
      this.docFields.data = {
        ...this.docFields.data,
        ...value.data,
        _id: cuid()
      };
    },
    updateFieldState(fieldState) {
      this.tabKey = cuid();
      for (const key in this.groups) {
        this.groups[key].fields.forEach(field => {
          if (fieldState[field]) {
            this.fieldErrors[key][field] = fieldState[field].error;
          }
        });
      }
      this.updateErrorCount();
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
.apos-schema__container {
  margin: 30px 15px 0;
}

.apos-image-cropper__container {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
