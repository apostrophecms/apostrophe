<template>
  <div class="apos-image-cropper">
    <cropper
      ref="cropper"
      :src="attachment._urls.uncropped
        ? attachment._urls.uncropped.original
        : attachment._urls.original"
      @change="onChange"
      :default-size="defaultSize"
      :default-position="defaultPosition"
      :stencil-props="{
        aspectRatio: getAspectRatio,
      }"
      :min-width="minSize[0]"
      :min-height="minSize[1]"
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
    },
    aspectRatio: {
      type: Array,
      default: null
    },
    minSize: {
      type: Array,
      default: () => ([])
    }
  },
  emits: [ 'change' ],
  data: () => ({
    isUpdatingCoordinates: false
  }),
  computed: {
    getAspectRatio() {
      if (!this.aspectRatio || this.aspectRatio.length !== 2) {
        return null;
      }

      const [ width, height ] = this.aspectRatio;

      return width / height;
    }
  },
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
    }
  }
};
</script>
<style lang='scss'>
.apos-image-cropper {
  max-width: 100%;
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
