<template>
  <div class="apos-image-cropper">
    <span
      class="apos-image-focal-point"
      ref="focalPoint"
      @mousedown="dragMouseDown"
    />
    <cropper
      ref="cropper"
      :src="attachment._urls.uncropped
        ? attachment._urls.uncropped.original
        : attachment._urls.original"
      :stencil-props="{ 'data-stencil': '' }"
      @change="onChange"
      :default-size="defaultSize"
      :default-position="defaultPosition"
    />
  </div>
</template>

<script>
import { debounce } from 'Modules/@apostrophecms/ui/utils';
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
    }
  },
  emits: [ 'change' ],
  data: () => ({
    isUpdatingCoordinates: false,
    focusPointCoordinates: {
      // TODO: set it to cropping center when mounted
      top: 0,
      left: 0
    },
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
          this.checkCoordinatesDiff(newVal.data, oldVal.data)
        ) {
          const {
            width, height, left, top
          } = newVal.data;

          this.isUpdatingCoordinates = true;
          this.setCoordinates({
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
    this.setCoordinates = debounce(
      (coordinates) => {
        this.$refs.cropper.setCoordinates(coordinates);
      }, 500
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
  destroyed() {
    const { focalPoint } = this.$refs;

    focalPoint.removeEventListener('mousedown', this.dragMouseDown);
  },
  methods: {
    onChange ({ coordinates }) {
      if (
        !this.isUpdatingCoordinates &&
        this.checkCoordinatesDiff(coordinates, this.docFields.data)
      ) {
        this.$emit('change', coordinates, false);
      }

      this.isUpdatingCoordinates = false;
    },
    checkCoordinatesDiff (coordinates, dataFields) {
      return Object.entries(coordinates)
        .some(([ name, value ]) => dataFields[name] !== value);
    },
    dragMouseDown (event) {
      const { focalPoint } = this.$refs;

      event.preventDefault();

      this.dragAndDrop.pos3 = event.clientX;
      this.dragAndDrop.pos4 = event.clientY;

      focalPoint.style.cursor = 'grabbing';
      document.addEventListener('mousemove', this.elementDrag);
      document.addEventListener('mouseup', this.closeDragElement);
    },
    elementDrag(event) {
      event.preventDefault();

      this.dragAndDrop.pos1 = this.dragAndDrop.pos3 - event.clientX;
      this.dragAndDrop.pos2 = this.dragAndDrop.pos4 - event.clientY;
      this.dragAndDrop.pos3 = event.clientX;
      this.dragAndDrop.pos4 = event.clientY;

      this.setFocalPointCoordinates();
    },
    closeDragElement() {
      const { focalPoint } = this.$refs;

      focalPoint.style.cursor = 'grab';
      document.removeEventListener('mousemove', this.elementDrag);
      document.removeEventListener('mouseup', this.closeDragElement);
    },
    setFocalPointCoordinates () {
      const { focalPoint } = this.$refs;

      const focalPointCoordinates = {
        left: focalPoint.offsetLeft - this.dragAndDrop.pos1,
        top: focalPoint.offsetTop - this.dragAndDrop.pos2
      };

      const stencilCoordinates = this.getStencilCoordinates();

      const focalPointHalfWidth = (focalPoint.clientWidth + focalPoint.clientLeft * 2) / 2;
      const focalPointHalfHeight = (focalPoint.clientHeight + focalPoint.clientTop * 2) / 2;

      if (
        focalPointCoordinates.left < stencilCoordinates.left - focalPointHalfWidth ||
        focalPointCoordinates.top < stencilCoordinates.top - focalPointHalfHeight ||
        focalPointCoordinates.left > stencilCoordinates.left - focalPointHalfWidth + stencilCoordinates.width ||
        focalPointCoordinates.top > stencilCoordinates.top - focalPointHalfHeight + stencilCoordinates.height
      ) {
        return;
      }

      focalPoint.style.left = `${focalPointCoordinates.left}px`;
      focalPoint.style.top = `${focalPointCoordinates.top}px`;
    },
    getStencilCoordinates () {
      // TODO: use something compatible, not WebKitCSSMatrix (DOMMatrixReadOnly? no because Internet Exp, regular style.transform?, getComputedStyle()?)
      const stencilElement = document.querySelector('[data-stencil]');
      const stencilStyle = window.getComputedStyle(stencilElement);
      const matrix = new window.WebKitCSSMatrix(stencilStyle.transform);

      return {
        left: matrix.m41,
        top: matrix.m42,
        width: stencilElement.clientWidth,
        height: stencilElement.clientHeight
      };
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
    border: 2px solid var(--a-white);
    background-color: var(--a-primary);
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
