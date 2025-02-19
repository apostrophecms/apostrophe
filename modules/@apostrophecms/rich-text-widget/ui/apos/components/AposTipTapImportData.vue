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
      @click="click"
    />
  </div>
</template>

<script setup>
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

</script>

<style lang="scss">

</style>
