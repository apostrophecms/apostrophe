<template>
  <AposTranslationIndicator
    v-if="isShowed"
    label="apostrophe:automaticTranslationFieldMeta"
  />
</template>

<script>
export default {
  name: 'AposTranslationMeta',
  props: {
    meta: {
      type: Object,
      required: true
    },
    metaRaw: {
      type: Object,
      required: true
    },
    field: {
      type: Object,
      required: true
    },
    items: {
      type: Array,
      default() {
        return [];
      }
    }
  },
  data() {
    return {
      isShowed: this.meta.data?.changed
    };
  }
};
</script>
