<template>
  <div class="apos-image-cropper">
    <span
      class="apos-image-focal-point"
      ref="focalPoint"
      @mousedown="onFocalPointMouseDown"
    />
    <cropper
      ref="cropper"
      :src="attachment._urls.uncropped
        ? attachment._urls.uncropped.original
        : attachment._urls.original"
      :stencil-props="{ 'data-stencil': '' }"
      :debounce="debounceTimeout"
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

// TODO: focal point tooltip
// TODO: clicking sets focal point
// TODO: fix cropper and focal point on load
// TODO: clean, jsdoc...

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
    debounceTimeout: 200,
    // coordinates based on cropper visible area, used to place the focal point in viewport
    stencilCoordinates: {
      left: null,
      top: null,
      width: null,
      height: null
    },
    isUpdatingCropperCoordinates: false,
    // TODO: rename these variables
    dragAndDrop: {
      pos1: 0,
      pos2: 0,
      pos3: 0,
      pos4: 0
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

    this.emitFocalPointCoordinates = debounce(coordinates => {
      console.log(coordinates);
      this.$emit('change', coordinates, false);
    }, this.debounceTimeout);

    this.placeFocalPointAfterResize = debounce(() => {
      this.storeStencilCoordinates();
      this.placeFocalPoint();
    }, this.debounceTimeout);

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

    window.removeEventListener('resize', this.placeFocalPointAfterResize);
  },
  methods: {
    onCropperReady () {
      this.storeStencilCoordinates();
      this.placeFocalPoint();

      window.addEventListener('resize', this.placeFocalPointAfterResize);
    },
    onCropperChange ({ coordinates }) {
      if (
        !this.isUpdatingCropperCoordinates &&
        this.checkCropperCoordinatesDiff(coordinates, this.docFields.data)
      ) {
        this.storeStencilCoordinates();

        // TODO: emit focal point new coordinates, stop placing
        // this.placeFocalPoint();

        this.$emit('change', coordinates, false);
      }

      this.isUpdatingCropperCoordinates = false;
    },
    onFocalPointMouseDown (event) {
      event.preventDefault();

      this.dragAndDrop.pos3 = event.clientX;
      this.dragAndDrop.pos4 = event.clientY;

      this.$refs.focalPoint.style.cursor = 'grabbing';
      this.$refs.focalPoint.style.transitionDuration = '0s';

      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', this.onMouseUp);
    },
    onMouseMove(event) {
      event.preventDefault();

      this.dragAndDrop.pos1 = this.dragAndDrop.pos3 - event.clientX;
      this.dragAndDrop.pos2 = this.dragAndDrop.pos4 - event.clientY;
      this.dragAndDrop.pos3 = event.clientX;
      this.dragAndDrop.pos4 = event.clientY;

      this.moveFocalPoint();
    },
    onMouseUp() {
      this.$refs.focalPoint.style.cursor = 'grab';
      this.$refs.focalPoint.style.transitionDuration = '0.1s';

      document.removeEventListener('mousemove', this.onMouseMove);
      document.removeEventListener('mouseup', this.onMouseUp);
    },
    checkCropperCoordinatesDiff (coordinates, dataFields) {
      return Object
        .entries(coordinates)
        .some(([ name, value ]) => dataFields[name] !== value);
    },
    /**
     * Store coordinates in order to use them
     * to keep focal point inside the stencil when moving it.
     */
    storeStencilCoordinates () {
      // TODO: use something compatible, not WebKitCSSMatrix (DOMMatrixReadOnly? no because Internet Exp, regular style.transform?, getComputedStyle()?)
      const stencilElement = document.querySelector('[data-stencil]');
      const stencilStyle = window.getComputedStyle(stencilElement);
      const matrix = new window.WebKitCSSMatrix(stencilStyle.transform);

      this.stencilCoordinates = {
        left: matrix.m41,
        top: matrix.m42,
        width: stencilElement.clientWidth,
        height: stencilElement.clientHeight
      };
    },
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
     * Place the focal point at its coordinates.
     */
    placeFocalPoint () {
      const { focalPoint } = this.$refs;
      const { x = 50, y = 50 } = this.docFields.data;

      const focalPointSize = this.getFocalPointSize();

      const left = Math.round(x / 100 * this.stencilCoordinates.width + this.stencilCoordinates.left - focalPointSize.halfWidth);
      const top = Math.round(y / 100 * this.stencilCoordinates.height + this.stencilCoordinates.top - focalPointSize.halfHeight);

      focalPoint.style.left = `${left}px`;
      focalPoint.style.top = `${top}px`;
    },
    /**
     * Drag focal point and emit its new coordinates (null if outside stencil).
     */
    moveFocalPoint () {
      const { focalPoint } = this.$refs;

      const focalPointSize = this.getFocalPointSize();

      const left = focalPoint.offsetLeft - this.dragAndDrop.pos1;
      const top = focalPoint.offsetTop - this.dragAndDrop.pos2;

      focalPoint.style.left = `${left}px`;
      focalPoint.style.top = `${top}px`;

      const x = (left + focalPointSize.halfWidth - this.stencilCoordinates.left) / this.stencilCoordinates.width * 100;
      const y = (top + focalPointSize.halfHeight - this.stencilCoordinates.top) / this.stencilCoordinates.height * 100;

      const sanitizeCoordinates = ({ x, y }) => (x >= 0 && x <= 100 && y >= 0 && y <= 100) ? {
        x: Math.abs(Math.round(x)),
        y: Math.abs(Math.round(y))
      } : {
        x: null,
        y: null
      };

      this.emitFocalPointCoordinates(
        sanitizeCoordinates({
          x,
          y
        })
      );
    }
  }
};
</script>
<style lang='scss'>
.apos-image-cropper {
  position: relative;
  max-width: 100%;

  .apos-image-focal-point {
    position: absolute;
    z-index: 1;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid var(--a-white);
    background-color: var(--a-primary);
    /* TODO: use box-shadow variable? */
    box-shadow: 0 0 4px 0 rgb(0 0 0 / 50%);
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
