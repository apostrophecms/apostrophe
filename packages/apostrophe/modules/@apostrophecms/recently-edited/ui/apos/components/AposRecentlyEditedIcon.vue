<template>
  <AposButton
    icon="recently-edited-icon"
    type="subtle"
    data-apos-test="recently-edited-icon"
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
