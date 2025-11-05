<template>
  <AposFolder
    v-for="folder in rootFolders"
    :folder="folder"
    @update="filter('_folders', $event)"
  />
</template>
<script setup>
import { computed } from 'vue';

const props = defineProps({
  folders: {
    type: Array
  }
});

const rootFolders = computed(() => props.value.folders.map(folder => !folder._parent));
const label = computed(() => props.value || 'None Selected');
const emit = defineEmits([ 'update' ]);
</script>

<style lang="scss">
