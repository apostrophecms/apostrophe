<template>
  <AposThinkingMark
    :label="label"
    data-apos-test="assistant-thinking"
  />
</template>

<script setup>
defineProps({
  label: {
    type: String,
    default: null
  }
});
</script>
