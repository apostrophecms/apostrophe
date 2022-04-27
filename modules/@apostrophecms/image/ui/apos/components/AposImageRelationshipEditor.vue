<template>
  <AposModal
    class="apos-doc-editor"
    :modal="modal"
    :modal-title="title"
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
          <div class="apos-field">
            <label class="apos-field__label">
              {{ $t('apostrophe:aspectRatio') }}
            </label>
            <AposSelect
              :choices="aspectRatios"
              :disabled="disableAspectRatios"
              @change="updateAspectRatio"
            />
          </div>
          <label class="apos-field__label">
            {{ $t('apostrophe:cropAndSize') }}
          </label>
          <div
            v-if="minSize[0] || minSize[1]"
            class="apos-field__min-size"
            :class="{'apos-field__min-size--correcting': correctingSizes}"
          >
            {{
              $t('apostrophe:minSize', {
                width: minSize[0] || '???',
                height: minSize[1] || '???'
              })
            }}
          </div>
          <div class="apos-schema__aligned-fields">
            <div class="apos-field">
              <label class="apos-field__label apos-field__label--aligned">
                W
              </label>
              <input
                :value="docFields.data.width"
                @input="inputWidth"
                @blur="blurInput"
                class="apos-input apos-input--text"
                type="number"
                :min="minSize[0] || 1"
                :max="item.attachment.width"
              >
            </div>
            <div class="apos-field">
              <label class="apos-field__label apos-field__label--aligned">
                H
              </label>
              <input
                :value="docFields.data.height"
                @input="inputHeight"
                @blur="blurInput"
                class="apos-input apos-input--text"
                type="number"
                :min="minSize[1] || 1"
                :max="item.attachment.height"
              >
            </div>
          </div>
        </div>
      </AposModalRail>
    </template>
    <template #main>
      <div class="apos-image-cropper__container">
        <AposImageCropper
          :attachment="item.attachment"
          :doc-fields="docFields"
          :aspect-ratio="aspectRatio"
          :min-size="minSize"
          @change="updateDocFields"
        />
      </div>
    </template>
  </AposModal>
</template>

<script>
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';
import getAspectRatios from '../lib/aspectRatios';

// TODO: persist aspectRatio value and use it on mount
// to automatically select the current aspect ratio
// (use `AposSelect` ":selected-value" prop to pass it).

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
    item: {
      type: Object,
      default: () => ({})
    }
  },
  emits: [ 'modal-result', 'safe-close' ],
  data() {
    const { aspectRatio, disableAspectRatios } = this.getAspectRatioFromConfig();

    console.log('typeof aspectRatio ===> ', typeof aspectRatio);

    return {
      original: this.value,
      docFields: {
        data: this.setDataValues()
      },
      errors: {},
      inputFocused: false,
      modal: {
        active: false,
        type: 'overlay',
        showModal: true
      },
      modalTitle: {
        key: 'apostrophe:editImageRelationshipTitle',
        title: this.title
      },
      currentTab: null,
      aspectRatio,
      aspectRatios: getAspectRatios(this.$t('apostrophe:aspectRatioFree')),
      disableAspectRatios,
      minSize: this.getMinSize(),
      correctingSizes: false
    };
  },
  async mounted() {
    this.modal.active = true;
  },
  methods: {
    setDataValues () {
      if (
        this.item._fields &&
        this.item._fields.width &&
        this.item._fields.height
      ) {
        return { ...this.item._fields };
      }

      return {
        width: this.item.attachment.width,
        height: this.item.attachment.height,
        top: 0,
        left: 0,
        x: null,
        y: null
      };
    },
    async submit() {
      if (this.item.attachment) {
        await apos.http.post(`${apos.attachment.action}/crop`, {
          body: {
            _id: this.item.attachment._id,
            crop: this.docFields.data
          }
        });
      }
      this.$emit('modal-result', this.docFields.data);
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
    inputWidth(e) {
      this.input(e, 'width');
    },
    inputHeight(e) {
      this.input(e, 'height');
    },
    input({ target }, name) {
      const value = parseInt(target.value, 10);

      if (isNaN(value)) {
        return;
      }

      this.computeAspectRatio(value, name);
      this.updateDocFields({ [name]: value });
    },
    isModified() {
      return detectDocChange(this.schema, this.original, this.docFields.data);
    },
    blurInput() {
      const maxSizeUpdated = [ 'width', 'height' ].reduce((acc, name) => {
        const minSize = name === 'width' ? this.minSize[0] : this.minSize[1];
        const maxSize = this.item.attachment[name];
        const value = parseInt(this.docFields.data[name], 10);

        if (value > maxSize) {
          this.updateDocFields({ [name]: maxSize });
          return true;
        }

        if (isNaN(minSize) || typeof minSize !== 'number' || value >= minSize) {
          return acc;
        }

        this.correctingSizes = true;
        this.updateDocFields({ [name]: minSize });

        setTimeout(() => {
          this.correctingSizes = false;
        }, 1500);

        return acc;
      }, false);

      if (!maxSizeUpdated || !this.aspectRatio || this.aspectRatio.length !== 2) {
        return;
      }

      const higherValueField = this.aspectRatio > 1 ? 'height' : 'width';

      this.computeAspectRatio(this.docFields.data[higherValueField], higherValueField);
    },
    switchPane(name) {
      this.currentTab = name;
    },
    getAspectRatioFromConfig() {
      const [ widgetOptions = {} ] = apos.area.widgetOptions || [];

      return widgetOptions.aspectRatio && widgetOptions.aspectRatio.length === 2
        ? {
          aspectRatio: widgetOptions.aspectRatio[0] / widgetOptions.aspectRatio[1],
          disableAspectRatios: true
        } : {
          aspectRatio: null,
          disableAspectRatios: false
        };
    },
    updateAspectRatio(value) {
      this.aspectRatio = parseFloat(value);
    },
    getMinSize() {
      const [ widgetOptions = {} ] = apos.area.widgetOptions;

      return widgetOptions.minSize || [];
    },
    computeAspectRatio(value, name) {
      if (!this.aspectRatio) {
        return;
      }

      const isWidth = name === 'width';
      const fieldToUpdate = isWidth ? 'height' : 'width';

      const computedValue = isWidth
        ? (value / this.aspectRatio)
        : (value * this.aspectRatio);

      this.updateDocFields({ [fieldToUpdate]: Math.round(computedValue) }, false);
    }
  }
};
</script>

<style scoped lang="scss" >
.apos-schema {
  margin: 30px 15px 0;

  > .apos-field {
    margin-bottom: 20px;
  }
}

.apos-schema__aligned-fields {
  display: flex;
  justify-content: space-between;
  flex-direction: row;

  .apos-field {
    display: flex;
    align-items: center;
    position: relative;
    flex-grow: 1;

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

.apos-input[type="number"] {
  padding-right: 5px;
}

.apos-field__min-size {
  @include type-small;
  color: var(--a-base-1);
  margin-bottom: 10px;

  &--correcting {
    color: var(--a-primary);
  }
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
  padding: 30px 0;
  height: calc(100vh - 40px - 75px);
  overflow: hidden;
  box-sizing: border-box;
}
</style>
