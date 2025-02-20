<template>
  <div class="apos-import-control">
    <AposButton
      type="rich-text"
      :class="{ 'apos-is-active': buttonActive }"
      :label="tool.label"
      :icon-only="!!tool.icon"
      :icon="tool.icon || false"
      :icon-size="tool.iconSize || 16"
      :modifiers="['no-border', 'no-motion']"
      :tooltip="{
        content: tool.label,
        placement: 'top',
        delay: 650
      }"
      @click="openFileManager"
    />
    <input
      ref="aposTiptapUpload"
      tabindex="-1"
      class="apos-sr-only"
      type="file"
      accept=".csv"
      @input="uploadFile"
    >
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { generateHTML } from '@tiptap/core';

const props = defineProps({
  tool: {
    type: Object,
    required: true
  },
  editor: {
    type: Object,
    required: true
  }
});
const aposTiptapUpload = ref(null);

function openFileManager() {
  aposTiptapUpload.value.click();
}

async function uploadFile({ target }) {
  const [ file ] = target.files;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const table = await apos.http.post('/api/v1/@apostrophecms/rich-text-widget/generate-csv-table', {
      body: formData
    });
    const html = generateHTML(table, props.editor.extensionManager.extensions);
    props.editor.commands.insertContent(html);
  } catch (err) {
    console.log('err', err);
    apos.notify('apostrophe:error', { type: 'error' });
  }
}
</script>

<style lang="scss">

</style>
