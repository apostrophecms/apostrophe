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
        <AposSchema
          :schema="visibleSchema"
          :value="docFields"
          :utility-rail="false"
          @input="updateDocFields"
        />
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
          @change="updateCropping"
        />
      </div>
    </template>
  </AposModal>
</template>

<script>
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';
import { klona } from 'klona';
import cuid from 'cuid';

export default {
  name: 'AposImageRelationshipEditor',
  mixins: [
    AposModifiedMixin
  ],
  props: {
    schema: {
      type: Array,
      default: () => []
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
      docFields: {
        data: {
          ...((this.value != null) ? this.value
            : Object.fromEntries(
              this.schema.map(field =>
                [ field.name, (field.def !== undefined) ? klona(field.def) : null ]
              )
            )
          )
        },
        hasErrors: false
      },
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
      visibleSchema: []
    };
  },
  async mounted() {
    this.modal.active = true;
    this.docReady = true;

    this.setVisibleSchema();
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
      // this.updateFieldState(value.fieldState);
      this.docFields.data = {
        _id: cuid(),
        ...this.docFields.data,
        ...value.data
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
    setVisibleSchema () {
      const fieldsToAlign = [ 'width', 'height' ];

      const visibleFields = this.schema.filter((field) => field.label &&
        !fieldsToAlign.includes(field.name));

      const alignedField = {
        name: 'cropFields',
        type: 'alignedFields',
        label: 'Crop Size (px)',
        fields: [
          ...this.schema.filter((field) => fieldsToAlign.includes(field.name))
        ]
      };

      this.visibleSchema = [
        ...visibleFields,
        alignedField
      ];

      console.log('this.visibleSchema ===> ', this.visibleSchema);
    },
    setFields () {
      // this.fields = this.schema.reduce((acc, field) => {
      //   if (!field.label) {
      //     return acc;
      //   }

      //   return {
      //     ...acc,
      //     [field.name]: field
      //   };
      // }, {});
    },
    switchPane(name) {
      this.currentTab = name;
    },
    updateCropping ({ coordinates, canvas }) {
      this.updateDocFields({ data: coordinates });
    }
  }
};
</script>

<style scoped lang="scss" >
.apos-image-cropper__container {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
