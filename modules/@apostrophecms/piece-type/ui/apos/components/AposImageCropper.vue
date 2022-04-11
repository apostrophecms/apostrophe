<template>
  <div class="apos-image-cropper">
    <cropper
      ref="cropper"
      :src="imgInfos.url"
      @change="onChange"
      :default-size="{width: imgInfos.width, height: imgInfos.height}"
      :default-position="{top: imgInfos.top, left: imgInfos.left}"
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
    updatingCoordinates: false
  }),
  computed: {
    defaultSize () {
      const { width, height } = this.docFields.data;

      return {
        width,
        height
      };
    }
  },
  watch: {
    docFields: {
      deep: true,
      handler(newVal, oldVal) {
        if (
          // newVal.data._id !== oldVal.data._id &&
          this.checkCoordinatesDiff(newVal.data, oldVal.data)
        ) {
          const {
            width, height, left, top
          } = newVal.data;

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
        console.log('=============> UPDATING COORD <================');
        this.updatingCoordinates = true;
        this.$refs.cropper.setCoordinates(coordinates);
      }, 500
    );
  },
  methods: {
    onChange ({ coordinates }) {

      console.log('this.updatingCoordinates ===> ', this.updatingCoordinates);
      if (
        !this.updatingCoordinates &&
        this.checkCoordinatesDiff(coordinates, this.docFields.data)
      ) {
        this.$emit('change', { data: coordinates });
      }

      this.updatingCoordinates = false;
      console.log('=============> FINISH UPDATING <================');

    },
    checkCoordinatesDiff (coordinates, dataFields) {
      const diff = Object.entries(coordinates)
        .some(([ name, value ]) => dataFields[name] !== value);

      console.log('diff ===> ', diff);

      return diff;
    }
  }
};
</script>
<style lang='scss'>
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
