<template>
  <div class="apos-image-widget">
    <AposMediaUploaderUi
      :min-size="[100, 100]"
      :accept="accept"
      @upload="upload"
      @media="media"
    />
  </div>
</template>

<script setup>
const moduleOptions = window.apos.modules['@apostrophecms/image'];
const accept = moduleOptions.schema.find(field => field.name === 'attachment').accept;

function media() {
}

function upload() {
}

</script>

<style lang="scss" scoped>

</style>
