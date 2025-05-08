<template>
  <AposModal
    class="apos-doc-editor"
    :modal="modal"
    :modal-title="$t('apostrophe:editImageRelationshipTitle')"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="confirmAndCancel"
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
        :disabled="!isModified"
        :attrs="{'data-apos-focus-priority': true}"
        @click="submit"
      />
    </template>
    <template #leftRail>
      <AposModalRail>
        <div class="apos-schema">
          <div
            class="apos-field"
            data-apos-field="aspectRatio"
          >
            <label class="apos-field__label">
              {{ $t('apostrophe:aspectRatio') }}
              <AposIndicator
                v-if="disableAspectRatio"
                class="apos-field__tooltip"
                icon="information-outline-icon"
                fill-color="var(--a-primary)"
                :tooltip="$t('apostrophe:aspectRatioWarning')"
              />
            </label>
            <AposSelect
              :selected="aspectRatio"
              :choices="aspectRatios"
              :disabled="disableAspectRatio"
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
            <div
              class="apos-field"
              data-apos-field="width"
            >
              <label class="apos-field__label apos-field__label--aligned">
                W
              </label>
              <input
                :value="docFields.data.width"
                class="apos-input apos-input--text"
                type="number"
                :min="minWidth"
                :max="maxWidth"
                @input="inputWidth"
                @blur="blurInput"
              >
            </div>
            <div
              class="apos-field"
              data-apos-field="height"
            >
              <label class="apos-field__label apos-field__label--aligned">
                H
              </label>
              <input
                :value="docFields.data.height"
                class="apos-input apos-input--text"
                type="number"
                :min="minHeight"
                :max="maxHeight"
                @input="inputHeight"
                @blur="blurInput"
              >
            </div>
          </div>
        </div>
      </AposModalRail>
    </template>
    <template #main>
      <div
        ref="cropperContainer"
        class="apos-image-cropper__container"
      >
        <AposImageCropper
          :attachment="image.attachment"
          :doc-fields="docFields"
          :aspect-ratio="aspectRatio"
          :min-size="minSize"
          :container-height="containerHeight"
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

export default {
  name: 'AposImageRelationshipEditor',
  mixins: [
    AposModifiedMixin
  ],
  props: {
    schema: {
      type: Array,
      default: null
    },
    widget: {
      type: Object,
      default: null
    },
    widgetSchema: {
      type: Array,
      default: () => ([])
    },
    item: {
      type: Object,
      default: null
    }
  },
  emits: [ 'modal-result' ],
  data() {
    const { aspectRatio, disableAspectRatio } = this.getAspectRatioFromConfig();
    const minSize = this.getMinSize();
    const image = this.getImage();
    const data = this.setDataValues(image);

    return {
      image,
      original: { ...data },
      docFields: {
        data
      },
      fieldSchema: this.getFieldSchema(),
      errors: {},
      modal: {
        active: false,
        type: 'overlay',
        showModal: true
      },
      modalTitle: {
        key: 'apostrophe:editImageRelationshipTitle',
        title: image.title
      },
      currentTab: null,
      aspectRatio,
      aspectRatios: getAspectRatios(this.$t('apostrophe:aspectRatioFree')),
      disableAspectRatio,
      minSize,
      correctingSizes: false,
      maxWidth: image.attachment.width,
      maxHeight: image.attachment.height,
      minWidth: minSize[0] || 1,
      minHeight: minSize[1] || 1,
      containerHeight: 0
    };
  },

  computed: {
    isModified() {
      return detectDocChange(this.fieldSchema, this.original, this.docFields.data);
    }
  },
  async mounted() {
    this.modal.active = true;

    this.$nextTick(() => {
      this.containerHeight = this.$refs.cropperContainer.clientHeight;
    });

    this.computeMaxSizes();
    this.computeMinSizes();
  },
  methods: {
    getImage() {
      return this.item || this.widget?._image?.[0];
    },
    getFieldSchema() {
      return this.schema ||
        this.widgetSchema.find((field) => field.name === '_image')?.schema || [];
    },
    computeMaxSizes() {
      const { width, height } = this.image.attachment;

      if (!this.aspectRatio) {
        this.maxWidth = width;
        this.maxHeight = height;

        return;
      }

      // If ratio wants a square, we simply take the lower size of the image
      if (this.aspectRatio === 1) {
        const lowerValue = width < height ? width : height;

        this.maxWidth = lowerValue;
        this.maxHeight = lowerValue;

        return;
      }

      const imageRatio = height / width;
      const ratio = imageRatio * this.aspectRatio;

      // If ratio is positive, we want to set max height
      // based on the width and vice versa
      this.maxWidth = ratio > 1
        ? width
        : Math.round(height * this.aspectRatio);
      this.maxHeight = ratio > 1
        ? Math.round(width / this.aspectRatio)
        : height;
    },
    computeMinSizes() {
      if (!this.minSize || !this.minSize.length) {
        return;
      }

      const [ minWidth, minHeight ] = this.minSize;

      if (!this.aspectRatio) {
        this.minWidth = minWidth;
        this.minHeight = minHeight;

        return;
      }

      // If ratio wants a square, we simply take the higher min size of the
      // image
      if (this.aspectRatio === 1) {
        const higherValue = minWidth > minHeight ? minWidth : minHeight;
        this.minWidth = higherValue;
        this.minHeight = higherValue;

        return;
      }

      const minSizeRatio = minHeight / minWidth;
      const ratio = minSizeRatio * this.aspectRatio;

      if (ratio > 1) {
        this.minWidth = Math.round(minHeight * this.aspectRatio);
        this.minHeight = minHeight;
      } else if (ratio < 1) {
        this.minWidth = minWidth;
        this.minHeight = Math.round(minWidth / this.aspectRatio);
      }
    },
    setDataValues(image) {
      if (
        image._fields &&
        image._fields.width &&
        image._fields.height
      ) {
        return { ...image._fields };
      }

      return {
        width: image.attachment.width,
        height: image.attachment.height,
        top: 0,
        left: 0,
        x: null,
        y: null
      };
    },
    async submit() {
      if (this.image.attachment) {
        await apos.http.post(`${apos.attachment.action}/crop`, {
          body: {
            _id: this.image.attachment._id,
            crop: this.docFields.data
          },
          busy: true
        });
      }

      if (!this.widget) {
        this.$emit('modal-result', this.docFields.data);
      } else {
        const image = {
          ...this.image,
          _fields: this.docFields.data
        };
        const widget = {
          ...this.widget,
          _image: [ image ]
        };

        this.$emit('modal-result', widget);
      }

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
    blurInput() {
      const { width, height } = this.docFields.data;

      if (!this.aspectRatio) {
        const { widthUpdated, minWidthUpdated } = width > this.maxWidth
          ? { widthUpdated: this.maxWidth }
          : width < this.minWidth && {
            widthUpdated: this.minWidth,
            minWidthUpdated: true
          };

        const { heightUpdated, minHeightUpdated } = height > this.maxHeight
          ? { heightUpdated: this.maxHeight }
          : height < this.minHeight && {
            heightUpdated: this.minHeight,
            minHeightUpdated: true
          };

        this.updateDocFields({
          ...widthUpdated && { width: widthUpdated },
          ...heightUpdated && { height: heightUpdated }
        }, false);

        if (minWidthUpdated || minHeightUpdated) {
          this.minSizeUpdated();
        }

        return;
      }

      if (width > this.maxWidth || height > this.maxHeight) {
        if (this.aspectRatio === 1) {
          const lowerValue = this.maxWidth < this.maxHeight
            ? this.maxWidth
            : this.maxHeight;

          this.updateDocFields({
            width: lowerValue,
            height: lowerValue
          }, false);
        } else {
          this.updateDocFields({
            width: this.maxWidth,
            height: this.maxHeight
          }, false);
        }
        return;
      }

      if (width < this.minWidth || height < this.minHeight) {
        if (this.aspectRatio === 1) {
          const higherValue = this.minWidth > this.minHeight
            ? this.minWidth
            : this.minHeight;

          this.updateDocFields({
            width: higherValue,
            height: higherValue
          }, false);
        } else {
          this.updateDocFields({
            width: this.minWidth,
            height: this.minHeight
          }, false);
        }

        this.minSizeUpdated();
      }
    },
    minSizeUpdated() {
      this.correctingSizes = true;

      setTimeout(() => {
        this.correctingSizes = false;
      }, 1500);
    },
    switchPane(name) {
      this.currentTab = name;
    },
    getAspectRatioFromConfig() {
      const [ widgetOptions = {} ] = apos.area.widgetOptions || [];

      return widgetOptions.aspectRatio && widgetOptions.aspectRatio.length === 2
        ? {
          aspectRatio: widgetOptions.aspectRatio[0] / widgetOptions.aspectRatio[1],
          disableAspectRatio: true
        }
        : {
          aspectRatio: null,
          disableAspectRatio: false
        };
    },
    updateAspectRatio(value) {
      this.aspectRatio = value;
      this.computeMaxSizes();
      this.computeMinSizes();
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

<style scoped lang="scss">
.apos-schema {
  margin: 30px 15px 0;

  .apos-field {
    margin-bottom: 20px;

    &__label {
      position: relative;
    }

    &__tooltip {
      position: absolute;
      top: 0;
      right: 0;
    }
  }
}

.apos-schema__aligned-fields {
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  .apos-field {
    position: relative;
    display: flex;
    flex-grow: 1;
    align-items: center;

    &:first-child {
      margin-right: 10px;
    }

    &__label {
      margin-right: 5px;
    }

    .apos-input {
      flex-grow: 1;
      margin-top: 0;
    }

    .apos-input:focus {
      border-color: var(--a-primary);
    }
  }
}

.apos-input[type='number'] {
  padding-right: 5px;
}

.apos-field__min-size {
  @include type-small;

  & {
    margin-bottom: 10px;
    color: var(--a-base-1);
  }

  &--correcting {
    color: var(--a-primary);
  }
}

.apos-field__label {
  @include type-label;

  & {
    display: block;
    margin: 0 0 $spacing-base;
    padding: 0;
    color: var(--a-text-primary);
  }
}

.apos-field__label--aligned {
  margin: 0;
}

.apos-image-cropper__container {
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  // We remove the modal's paddings - header height - container margin
  height: calc(100vh - 40px - 75px - 60px);
  margin: 30px 10%;
}
</style>
