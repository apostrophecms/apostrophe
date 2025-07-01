<template>
  <div
    class="apos-import-control"
    :class="{'apos-import-control__hidden': insertMode}"
  >
    <AposButton
      v-if="tool"
      type="rich-text"
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
      @input="generateTable"
      @cancel="close"
    >
  </div>
</template>

<script setup>
import {
  ref, onMounted, computed
} from 'vue';

const props = defineProps({
  tool: {
    type: Object,
    default: null
  },
  editor: {
    type: Object,
    required: true
  }
});
const emit = defineEmits([ 'done', 'close', 'before-commands' ]);

const insertMode = computed(() => {
  return !props.tool;
});

onMounted(() => {
  // When opened from the insert menu we want to open the file manager directly
  if (insertMode.value) {
    openFileManager();
  }
});

const aposTiptapUpload = ref(null);

function openFileManager() {
  aposTiptapUpload.value.click();
}

async function generateTable({ target }) {
  emit('before-commands');
  const [ file ] = target.files;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const table = await apos.http.post('/api/v1/@apostrophecms/rich-text-widget/generate-csv-table', {
      body: formData
    });
    props.editor.commands.insertContent(table);
  } catch (err) {
    apos.notify('apostrophe:error', { type: 'error' });
  }

  if (insertMode.value) {
    emit('done');
  }
}

function close() {
  emit('close');
}
</script>

<style lang="scss">
.apos-import-control__hidden {
  visibility: hidden;
}
</style>
