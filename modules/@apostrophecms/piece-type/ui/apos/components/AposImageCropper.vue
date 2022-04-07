<template>
  <div class="apos-image-cropper">
    <cropper
      :src="imgInfos.url"
      @change="(data) => $emit('change', data)"
      :default-size="{width: imgInfos.width, height: imgInfos.height}"
      :default-position="{top: imgInfos.top, left: imgInfos.left}"
    />
  </div>
</template>

<script>
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
    }
  },
  emits: [ 'change' ]
};
</script>
<style lang='scss'>
.vue-handler-wrapper {
  .vue-simple-handler {
    width: 7px;
    height: 7px;
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
