<template>
  <div
    class="apos-image-cropper"
    @click="onImageClick"
  >
    <span
      class="apos-image-focal-point"
      ref="focalPoint"
      v-apos-tooltip="'apostrophe:focalPoint'"
      @mousedown="onFocalPointMouseDown"
    />
    <cropper
      ref="cropper"
      :src="attachment._urls.uncropped
        ? attachment._urls.uncropped.original
        : attachment._urls.original"
      :stencil-props="{ 'data-stencil': '' }"
      :debounce="0"
      @ready="onCropperReady"
      @change="onCropperChange"
      :default-size="defaultSize"
      :default-position="defaultPosition"
    />
  </div>
</template>

<script>
import { debounce } from 'Modules/@apostrophecms/ui/utils';
import { Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';

const DEBOUNCE_TIMEOUT = 500;

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
    }
  },
  emits: [ 'change' ],
  data: () => ({
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
  }),
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
          this.setCropperCoordinates({
            width,
            height,
            left,
            top
          });
        }
      }
    }
  },
  created () {
    this.setCropperCoordinates = debounce(coordinates => {
      this.$refs.cropper.setCoordinates(coordinates);
    }, this.debounceTimeout);

    this.placeFocalPointInStencilAfterResize = debounce(() => {
      this.storeStencilCoordinates();
      this.placeFocalPointInStencil();
    }, this.debounceTimeout);

    this.handleCropperChangeDebounced = debounce(this.handleCropperChange, this.debounceTimeout);

    this.updateFocalPointCoordinatesDebounced = debounce(this.updateFocalPointCoordinates, this.debounceTimeout);

    this.defaultSize = {
      width: this.docFields.data.width,
      height: this.docFields.data.height
    };

    this.defaultPosition = {
      top: this.docFields.data.top,
      left: this.docFields.data.left
    };
  },
  beforeDestroy() {
    this.$refs.focalPoint.removeEventListener('mousedown', this.onFocalPointMouseDown);

    window.removeEventListener('resize', this.placeFocalPointInStencilAfterResize);
  },
  methods: {
    /**
     * Place the focal point inside the stencil
     * and register an event to keep it at the
     * same position, relative to the stencil,
     * when resizing the screen.
     */
    onCropperReady () {
      this.storeStencilCoordinates();
      this.placeFocalPointInStencil();

      window.addEventListener('resize', this.placeFocalPointInStencilAfterResize);
    },
    /**
     * Instantly give the information that cropper is changing
     * and handle its new coordinates.
     * Please note that debounce is handled manually here,
     * not via the cropper `debounce` prop so that we directly have
     * the information it is changing, not after its debounce time.
     */
    onCropperChange ({ coordinates }) {
      this.isChangingCropper = true;

      this.handleCropperChangeDebounced(coordinates);
    },
    /**
     * Register events and coordinates to handle drag & drop.
     * Update CSS values during manipulation to have a smooth and clean
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
     * Move focal point to follow the mouse pointer
     * and update its new coordinates.
     */
    onFocalPointMouseMove(event) {
      event.preventDefault();

      const { focalPoint } = this.$refs;

      const left = focalPoint.offsetLeft - this.focalPointDragCoordinates.clientX + event.clientX;
      const top = focalPoint.offsetTop - this.focalPointDragCoordinates.clientY + event.clientY;

      this.focalPointDragCoordinates.clientX = event.clientX;
      this.focalPointDragCoordinates.clientY = event.clientY;

      focalPoint.style.left = `${left}px`;
      focalPoint.style.top = `${top}px`;

      this.updateFocalPointCoordinatesDebounced();
    },
    /**
     * Remove events when releasing click on the focal point element.
     * Revert CSS values after manipulation.
     */
    onFocalPointMouseUp() {
      const { focalPoint } = this.$refs;

      focalPoint.style.cursor = 'grab';
      focalPoint.style.transitionDuration = '0.1s';

      document.removeEventListener('mousemove', this.onFocalPointMouseMove);
      document.removeEventListener('mouseup', this.onFocalPointMouseUp);
    },
    /**
     * Place focal point at the position where the image has been clicked
     * and update its new coordinates.
     * Position it in relation of the current target offset
     * in order to set the `left` and `top` properties accordingly.
     * Do not place focal point when cropper is changing (move or resize)
     * to keep a friendly user experience.
     */
    onImageClick (event) {
      if (this.isChangingCropper) {
        return;
      }

      const { focalPoint } = this.$refs;

      const focalPointSize = this.getFocalPointSize();

      const left = event.clientX - event.currentTarget.offsetLeft - event.currentTarget.offsetParent.offsetLeft - focalPointSize.halfWidth;
      const top = event.clientY - event.currentTarget.offsetTop - event.currentTarget.offsetParent.offsetTop - focalPointSize.halfHeight;

      focalPoint.style.left = `${left}px`;
      focalPoint.style.top = `${top}px`;

      this.updateFocalPointCoordinatesDebounced();
    },
    /**
     * Update stencil and focal point coordinates
     * after cropper has changed and emit its new coordinates.
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
     * Return wether the cropper coordinates have changed or not.
     */
    checkCropperCoordinatesDiff (coordinates, dataFields) {
      return Object
        .entries(coordinates)
        .some(([ name, value ]) => dataFields[name] !== value);
    },
    /**
     * Store the stencil actual coordinates relative to the viewport,
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
     * Return the size and half size of the focal point element,
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
     * Place the focal point at its current coordinates
     * inside the stencil or at the center of it by default.
     */
    placeFocalPointInStencil () {
      const { focalPoint } = this.$refs;

      const x = this.docFields.data.x || 50;
      const y = this.docFields.data.y || 50;

      const focalPointSize = this.getFocalPointSize();

      const left = Math.round(x / 100 * this.stencilCoordinates.width + this.stencilCoordinates.left - focalPointSize.halfWidth);
      const top = Math.round(y / 100 * this.stencilCoordinates.height + this.stencilCoordinates.top - focalPointSize.halfHeight);

      focalPoint.style.left = `${left}px`;
      focalPoint.style.top = `${top}px`;
    },
    /**
     * Get focal point relative position inside the stencil
     * and emit it to update `x` and `y` as percentages,
     * or as `null` if outside it.
     */
    updateFocalPointCoordinates () {
      const { focalPoint } = this.$refs;

      const focalPointSize = this.getFocalPointSize();

      const x = (focalPoint.offsetLeft + focalPointSize.halfWidth - this.stencilCoordinates.left) / this.stencilCoordinates.width;
      const y = (focalPoint.offsetTop + focalPointSize.halfHeight - this.stencilCoordinates.top) / this.stencilCoordinates.height;

      const sanitizeCoordinates = ({ x, y }) => (x >= 0 && x <= 1 && y >= 0 && y <= 1) ? {
        x: Math.abs(Math.round(x * 100)),
        y: Math.abs(Math.round(y * 100))
      } : {
        x: null,
        y: null
      };

      const coordinates = sanitizeCoordinates({
        x,
        y
      });

      this.$emit('change', coordinates, false);
    }
  }
};
</script>
<style lang='scss'>
.apos-image-cropper {
  position: relative;
  max-width: 100%;
  cursor: pointer;

  .apos-image-focal-point {
    position: absolute;
    z-index: 1;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid var(--a-white);
    background-color: var(--a-primary);
    box-shadow: 0 0 4px var(--a-black);
    transition: left 0.1s ease, top 0.1s ease;
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
