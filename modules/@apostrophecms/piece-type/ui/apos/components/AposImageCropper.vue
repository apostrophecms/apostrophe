<template>
  <div class="apos-image-cropper">
    <cropper
      ref="cropper"
      :src="imgInfos.url"
      @change="onChange"
      :default-size="defaultSize"
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
    imgInfos: {
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
    isUpdatingCoordinates: false
  }),
  watch: {
    docFields: {
      deep: true,
      handler(newVal, oldVal) {
        if (this.checkCoordinatesDiff(newVal.data, oldVal.data)) {
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
  },
  methods: {
    defaultSize({ imageSize, visibleArea }) {
      return {
        width: (visibleArea || imageSize).width,
        height: (visibleArea || imageSize).height
      };
    },
    onChange ({ coordinates }) {
      if (
        !this.isUpdatingCoordinates &&
        this.checkCoordinatesDiff(coordinates, this.docFields.data)
      ) {
        this.$emit('change', { data: coordinates }, true);
      }

      this.isUpdatingCoordinates = false;
    },
    checkCoordinatesDiff (coordinates, dataFields) {
      return Object.entries(coordinates)
        .some(([ name, value ]) => name !== '_id' && dataFields[name] !== value);
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
