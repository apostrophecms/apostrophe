<template>
  <div
    class="apos-image-cropper"
    :style="{
      height: cropperHeight
    }"
    @click="onImageClick"
  >
    <span
      ref="focalPoint"
      v-apos-tooltip="'apostrophe:focalPoint'"
      class="apos-image-focal-point"
      @mousedown="onFocalPointMouseDown"
    />
    <cropper
      ref="cropper"
      :src="attachment._urls.uncropped
        ? attachment._urls.uncropped.original
        : attachment._urls.original"
      :debounce="0"
      :default-size="defaultSize"
      :default-position="defaultPosition"
      :stencil-props="stencilProps"
      :min-width="minSize[0]"
      :min-height="minSize[1]"
      @ready="onCropperReady"
      @change="onCropperChange"
    />
  </div>
</template>

<script>
import debounce from 'lodash/debounce';
import { Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';

export default {
  components: {
    Cropper
  },
  props: {
    attachment: {
      type: Object,
      required: true
    },
    docFields: {
      type: Object,
      required: true
    },
    aspectRatio: {
      type: Number,
      default: null
    },
    minSize: {
      type: Array,
      default: () => ([])
    },
    containerHeight: {
      type: Number,
      required: true
    }
  },
  emits: [ 'change' ],
  data () {
    return {
      stencilProps: {
        'data-stencil': ''
      },
      cropperHeight: this.getCropperHeight(),
      isCropperChanging: false,
      isUpdatingCropperCoordinates: false,
      stencilCoordinates: {
        left: null,
        top: null,
        width: null,
        height: null
      },
      focalPointDragCoordinates: {
        clientX: 0,
        clientY: 0
      }
    };
  },
  watch: {
    docFields: {
      deep: true,
      handler(newVal, oldVal) {
        if (
          newVal.updateCoordinates &&
          this.checkCropperCoordinatesDiff(newVal.data, oldVal.data)
        ) {
          const {
            width, height, left, top
          } = newVal.data;

          this.isUpdatingCropperCoordinates = true;
          this.setCropperCoordinatesDebounced({
            width,
            height,
            left,
            top
          });
        }
      }
    },
    aspectRatio: {
      handler(newVal) {
        this.$refs.cropper.reset();
        this.stencilProps.aspectRatio = newVal;
        this.$refs.cropper.refresh();
      }
    }
  },
  created () {
    const DEBOUNCE_TIMEOUT = 500;

    this.onScreenResizeDebounced = debounce(this.onScreenResize, DEBOUNCE_TIMEOUT);
    this.handleCropperChangeDebounced = debounce(
      this.handleCropperChange,
      DEBOUNCE_TIMEOUT
    );
    this.setCropperCoordinatesDebounced = debounce(
      this.setCropperCoordinates,
      DEBOUNCE_TIMEOUT
    );
    this.updateFocalPointCoordinatesDebounced = debounce(
      this.updateFocalPointCoordinates,
      DEBOUNCE_TIMEOUT
    );

    this.defaultSize = {
      width: this.docFields.data.width,
      height: this.docFields.data.height
    };
    this.defaultPosition = {
      top: this.docFields.data.top,
      left: this.docFields.data.left
    };
  },
  beforeUnmount() {
    this.onScreenResizeDebounced.cancel();
    this.handleCropperChangeDebounced.cancel();
    this.setCropperCoordinatesDebounced.cancel();
    this.updateFocalPointCoordinatesDebounced.cancel();
    this.$refs.focalPoint.removeEventListener('mousedown', this.onFocalPointMouseDown);
    window.removeEventListener('resize', this.onScreenResizeDebounced);
  },
  methods: {
    getCropperHeight() {
      const { width, height } = this.attachment;

      // If the image is landscape, we don't set any height (properly managed
      // by the lib) Otherwise we want to avoid the cropper to exceed the max
      // height
      return width > height || height <= this.containerHeight
        ? 'auto'
        : '100%';
    },
    /**
     * Places the focal point inside the stencil to its current position.
     */
    onCropperReady () {
      this.stencilProps.aspectRatio = this.aspectRatio;
      this.$refs.cropper.refresh();

      this.storeStencilCoordinates();
      this.placeFocalPointInStencil();

      window.addEventListener('resize', this.onScreenResizeDebounced);
    },
    /**
     * Instantly gives the information that cropper is changing
     * and handles its new coordinates.
     * Please note that debounce is handled manually here,
     * not via the cropper `debounce` prop so that we directly have
     * the information it is changing, not after its debounce time.
     */
    onCropperChange ({ coordinates }) {
      this.isChangingCropper = true;

      this.handleCropperChangeDebounced(coordinates);
    },
    /**
     * Registers events and coordinates to handle drag & drop.
     * Updates CSS values during manipulation to have a smooth and clean
     * drag & drop experience (pause transition when moving the focal point).
     */
    onFocalPointMouseDown (event) {
      event.preventDefault();

      const { focalPoint } = this.$refs;

      this.focalPointDragCoordinates.clientX = event.clientX;
      this.focalPointDragCoordinates.clientY = event.clientY;

      focalPoint.style.cursor = 'grabbing';
      focalPoint.style.transitionDuration = '0s';

      document.addEventListener('mousemove', this.onFocalPointMouseMove);
      document.addEventListener('mouseup', this.onFocalPointMouseUp);
    },
    /**
     * Moves focal point to follow the mouse pointer
     * and updates its new coordinates.
     */
    onFocalPointMouseMove(event) {
      event.preventDefault();

      const { focalPoint } = this.$refs;

      const focalPointSize = this.getFocalPointSize();

      const left = focalPoint.offsetLeft -
        this.focalPointDragCoordinates.clientX + event.clientX;
      const top = focalPoint.offsetTop -
        this.focalPointDragCoordinates.clientY + event.clientY;

      this.focalPointDragCoordinates.clientX = event.clientX;
      this.focalPointDragCoordinates.clientY = event.clientY;

      // For some reason, positioning the focal point at the very top of the
      // image results in having a negative `top` value. Let's apply a margin of
      // error for every edge to prevent having `null` focal point values when
      // placing it at the image borders.
      const MARGIN_OF_ERROR = 1;

      const limits = {
        left: -focalPointSize.halfWidth + MARGIN_OF_ERROR,
        top: -focalPointSize.halfHeight + MARGIN_OF_ERROR,
        right: focalPoint.offsetParent.clientWidth -
          focalPointSize.halfWidth - MARGIN_OF_ERROR,
        bottom: focalPoint.offsetParent.clientHeight -
          focalPointSize.halfHeight - MARGIN_OF_ERROR
      };

      if (
        left < limits.left ||
        top < limits.top ||
        left > limits.right ||
        top > limits.bottom
      ) {
        return;
      };

      focalPoint.style.left = `${left}px`;
      focalPoint.style.top = `${top}px`;

      this.updateFocalPointCoordinatesDebounced();
    },
    /**
     * Removes events when releasing click on the focal point element.
     * Reverts CSS values after manipulation.
     */
    onFocalPointMouseUp() {
      const { focalPoint } = this.$refs;

      focalPoint.style.cursor = 'grab';
      focalPoint.style.transitionDuration = '0.1s';

      document.removeEventListener('mousemove', this.onFocalPointMouseMove);
      document.removeEventListener('mouseup', this.onFocalPointMouseUp);
    },
    /**
     * Places focal point at the position where the image has been clicked
     * and updates its new coordinates.
     * Positions it in relation of the current target offset
     * in order to set the `left` and `top` properties accordingly.
     * Does not place focal point when cropper is changing (move or resize)
     * to keep a friendly user experience.
     */
    onImageClick (event) {
      if (this.isChangingCropper) {
        return;
      }

      const { focalPoint } = this.$refs;

      const focalPointSize = this.getFocalPointSize();

      const left =
        event.clientX -
        event.currentTarget.offsetLeft -
        event.currentTarget.offsetParent.offsetLeft -
        focalPointSize.halfWidth;
      const top =
        event.clientY -
        event.currentTarget.offsetTop -
        event.currentTarget.offsetParent.offsetTop -
        focalPointSize.halfHeight;

      focalPoint.style.left = `${left}px`;
      focalPoint.style.top = `${top}px`;

      this.updateFocalPointCoordinatesDebounced();
    },
    /**
     * Places the focal point back to its position (inside the stencil),
     * when resizing the screen so that the percentages
     * relative to the stencil remain the same.
     */
    onScreenResize () {
      this.storeStencilCoordinates();
      this.placeFocalPointInStencil();
    },
    /**
     * Updates stencil and focal point coordinates
     * after cropper has changed and emits its new coordinates.
     */
    handleCropperChange (coordinates) {
      this.isChangingCropper = false;

      if (
        !this.isUpdatingCropperCoordinates &&
        this.checkCropperCoordinatesDiff(coordinates, this.docFields.data)
      ) {
        this.storeStencilCoordinates();
        this.updateFocalPointCoordinates();

        this.$emit('change', coordinates, false);
      }

      this.isUpdatingCropperCoordinates = false;
    },
    /**
     * Sets cropper coordinates via its API.
     */
    setCropperCoordinates (coordinates) {
      this.$refs.cropper.setCoordinates(coordinates);
    },
    /**
     * Gets focal point relative position inside the stencil
     * and emits it to update `x` and `y` as percentages,
     * or as `null` if outside it.
     */
    updateFocalPointCoordinates () {
      const { focalPoint } = this.$refs;

      const focalPointSize = this.getFocalPointSize();

      const x = (
        focalPoint.offsetLeft +
        focalPointSize.halfWidth -
        this.stencilCoordinates.left
      ) / this.stencilCoordinates.width;
      const y = (
        focalPoint.offsetTop +
        focalPointSize.halfHeight -
        this.stencilCoordinates.top
      ) / this.stencilCoordinates.height;

      const coordinates = sanitizeCoordinates({
        x,
        y
      });

      this.$emit('change', coordinates, false);

      function sanitizeCoordinates ({ x, y }) {
        return (x >= 0 && x <= 1 && y >= 0 && y <= 1)
          ? {
            x: Math.abs(Math.round(x * 100)),
            y: Math.abs(Math.round(y * 100))
          }
          : {
            x: null,
            y: null
          };
      }
    },
    /**
     * Returns whether the cropper coordinates have changed or not.
     */
    checkCropperCoordinatesDiff (coordinates, dataFields) {
      return Object
        .entries(coordinates)
        .some(([ name, value ]) => dataFields[name] !== value);
    },
    /**
     * Stores the stencil actual coordinates relative to the viewport,
     * which are used for focal point DOM manipulation and its
     * relative position calculation.
     */
    storeStencilCoordinates () {
      const stencilElement = document.querySelector('[data-stencil]');
      const stencilStyle = window.getComputedStyle(stencilElement);
      const matrix = new window.DOMMatrixReadOnly(stencilStyle.transform);

      this.stencilCoordinates = {
        left: matrix.m41,
        top: matrix.m42,
        width: stencilElement.clientWidth,
        height: stencilElement.clientHeight
      };
    },
    /**
     * Returns the size and half size of the focal point element,
     * used for its DOM manipulation and relative position calculation.
     */
    getFocalPointSize () {
      const { focalPoint } = this.$refs;

      const size = {
        width: focalPoint.clientWidth + focalPoint.clientLeft * 2,
        height: focalPoint.clientHeight + focalPoint.clientTop * 2
      };

      return {
        ...size,
        halfWidth: size.width / 2,
        halfHeight: size.height / 2
      };
    },
    /**
     * Places the focal point at its current coordinates
     * inside the stencil or at the center of it by default.
     */
    placeFocalPointInStencil () {
      const { focalPoint } = this.$refs;

      const x = this.docFields.data.x || 50;
      const y = this.docFields.data.y || 50;

      const focalPointSize = this.getFocalPointSize();

      const left = Math.round(
        x / 100 * this.stencilCoordinates.width +
        this.stencilCoordinates.left -
        focalPointSize.halfWidth
      );
      const top = Math.round(
        y / 100 * this.stencilCoordinates.height +
        this.stencilCoordinates.top -
        focalPointSize.halfHeight
      );

      focalPoint.style.left = `${left}px`;
      focalPoint.style.top = `${top}px`;
    }
  }
};
</script>
<style lang='scss'>
.apos-image-cropper {
  position: relative;
  max-width: 100%;
  // height: auto;
  max-height: 100%;
  cursor: pointer;
  // flex-shrink: 1;
  // flex-grow: 0;

  .apos-image-focal-point {
    z-index: $z-index-default;
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid var(--a-white);
    background-color: var(--a-primary);
    box-shadow: 0 0 4px var(--a-black);
    transition: left 200ms ease, top 200ms ease;
    cursor: grab;
  }
}

.vue-handler-wrapper {
  .vue-simple-handler {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    border: 3px solid var(--a-primary);
    background-color: var(--a-base-7);
  }
}

.vue-line-wrapper {
  .vue-simple-line {
    border-style: dashed;
    border-width: 1px;
  }
}
</style>
