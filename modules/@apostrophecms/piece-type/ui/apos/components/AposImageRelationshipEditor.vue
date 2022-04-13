<template>
  <AposModal
    class="apos-doc-editor"
    :modal="modal"
    :modal-title="item.title"
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
          <label class="apos-field__label">
            Crop & Size (px)
          </label>
          <div v-if="errors.width || errors.height" class="apos-field__size-error">
            {{
              $t('apostrophe:minSize', {
                width: item.attachment.width,
                height: item.attachment.height })
            }}
          </div>
          <div class="apos-schema__aligned-fields">
            <div class="apos-field">
              <label class="apos-field__label apos-field__label--aligned">
                W
              </label>
              <input
                :value="docFields.data.width"
                @input="(e) => input(e, 'width')"
                @focus="focusInput"
                class="apos-input apos-input--text"
                type="number"
                min="1"
                :max="item.attachment.width"
              >
            </div>
            <div class="apos-field">
              <label class="apos-field__label apos-field__label--aligned">
                H
              </label>
              <input
                :value="docFields.data.height"
                @input="(e) => input(e, 'height')"
                class="apos-input apos-input--text"
                type="number"
                min="1"
                :max="item.attachment.height"
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
          :attachment="item.attachment"
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
    item: {
      type: Object,
      required: true
    }
  },
  emits: [ 'modal-result', 'safe-close' ],
  data() {
    return {
      original: this.value,
      docFields: {
        data: {
          width: 0,
          height: 0,
          top: 0,
          left: 0
        }
      },
      errors: {},
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
    console.log('this.item ===> ', this.item);
    this.modal.active = true;

    // this.setVisibleSchema();
    // this.setNestedSchema();

    // this.setGroups();
    // this.setTabs();
    // this.setFields();
  },
  methods: {
    async submit() {
      await apos.http.post(`${apos.attachment.action}/crop`, {
        body: {
          _id: this.id,
          crop: this.docFields
        }
      });
      this.$emit('modal-result', this.docFields);
      this.modal.showModal = false;
    },
    updateDocFields(coordinates, updateCoordinates = true) {
      this.docFields = {
        data: {
          ...this.docFields.data,
          ...coordinates
        },
        updateCoordinates
      };
    },
    input({ target }, name) {
      const value = parseInt(target.value, 10);

      if (isNaN(value)) {
        return;
      }

      this.errors[name] = value > this.item.attachment[name];

      this.updateDocFields({ [name]: parseInt(target.value, 10) });
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
    // setDocFields (original) {
    //   const doc = original ||
    //     Object.fromEntries(
    //       this.schema.map(field => ([ field.name, null ]))
    //     );

    //   return {
    //     data: {
    //       ...Object.entries(doc).reduce((acc, [ name, value ]) => {
    //         return {
    //           ...acc,
    //           [name]: typeof value === 'number' ? value : (this.imgInfos[name] || null)
    //         };
    //       }, {})
    //     },
    //     hasErrors: false
    //   };
    // },
    focusInput (param) {
      console.log('param ===> ', param);
    },
    setVisibleSchema () {
      const visibleSchema = this.schema.filter((field) => field.label);

      this.visibleSchema = this.formatSizeFields(visibleSchema);
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
}

.apos-schema__aligned-fields {
  display: flex;
  justify-content: space-between;
  flex-direction: row;

  .apos-field {
    display: flex;
    align-items: center;
    position: relative;

    &:first-child {
      margin-right: 10px;
    }

    &__label {
      margin-right: 5px;
    }

    .apos-input {
      margin-top: 0;
      flex-grow: 1;
    }

    .apos-input:focus {
      border-color: var(--a-primary);
    }
  }
}

.apos-field__size-error {
  @include type-small;
  color: var(--a-base-1);
  margin-bottom: 10px;
}

.apos-field__label {
  @include type-label;
  display: block;
  margin: 0 0 $spacing-base;
  padding: 0;
  color: var(--a-text-primary);
}

.apos-field__label--aligned {
  margin: 0
}

.apos-image-cropper__container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 10%;
}
</style>
