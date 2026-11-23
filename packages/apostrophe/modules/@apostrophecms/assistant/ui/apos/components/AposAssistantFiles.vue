<template>
  <ul
    class="apos-assistant-files"
    :aria-label="$t('apostrophe:assistantFiles')"
    data-apos-test="assistant-files"
  >
    <li
      v-for="file in files"
      :key="file.key"
      class="apos-assistant-files__item"
    >
      <AposAssistantFile
        :name="file.name"
        :size="file.size"
        :src="file.src"
        :picture="file.picture ?? null"
        :uploading="file.uploading"
        :gone="file.gone"
        :removable="removable"
        :openable="Boolean(file.large)"
        :href="file.href"
        @remove="emit('remove', file.key)"
        @open="open(file)"
      />
    </li>
  </ul>
</template>

<script setup>
import AposAssistantFile from './AposAssistantFile.vue';

// A request's files in a row that wraps: the composer's, each with its ×,
// or a sent message's, an image opening large (`large`, its URL)
defineProps({
  // `{ key, name, size, src, picture, uploading, gone, href, large }`
  files: {
    type: Array,
    required: true
  },
  removable: {
    type: Boolean,
    default: false
  }
});
const emit = defineEmits([ 'remove' ]);

function open(file) {
  apos.modal.execute('AposAssistantLightbox', {
    src: file.large,
    alt: file.name
  });
}
</script>

<style lang="scss" scoped>
  .apos-assistant-files {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .apos-assistant-files__item {
    display: flex;
    max-width: 100%;
  }
</style>
