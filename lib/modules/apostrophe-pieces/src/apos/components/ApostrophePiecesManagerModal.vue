<template>
  <ApostropheModal @close="$emit('close')">
    <template slot="header">
      <!-- TODO i18n -->
      Manage {{ label }}
    </template>
    <template slot="body">
      <p>Render the list view and filters and pagination here</p>
    </template>
    <!-- Could do footer too -->
  </ApostropheModal>
</template>

<script>
export default {
  name: 'ApostrophePiecesManagerModal',
  props: {
    options: Object
  },
  computed: {
    label() {
      console.log(apos.modules[this.options.moduleName]);
      return apos.modules[this.options.moduleName].pluralLabel;
    }
  }
};
</script>
