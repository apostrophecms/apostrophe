<template>
  <AposButton
    icon="clock-outline-icon"
    type="subtle"
    :modifiers="['small', 'no-motion']"
    :tooltip="$t('apostrophe:recentlyEditedDocuments')"
    :icon-only="true"
    @click="open"
  />
</template>
<script setup>
function open() {
  apos.bus.$emit('admin-menu-click', '@apostrophecms/recently-edited:manager');
}
</script>
