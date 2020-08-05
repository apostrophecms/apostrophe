<template>
  <ApostropheModal @close="$emit('close')">
    <template slot="header">
      <!-- TODO i18n -->
      <p>New {{ moduleOptions.label }}</p>
    </template>
    <template slot="body">
      <AposSchema :schema="moduleOptions.schema" v-model="pieceInfo" />
    </template>
    <template slot="footer">
      <slot name="footer">
        <button class="modal-default-button" @click="$emit('close')">
          Cancel
        </button>
        <button v-if="!pieceInfo.hasErrors" class="modal-default-button" @click="save()">
          Save
        </button>
      </slot>
    </template>
  </ApostropheModal>
</template>

<script>

export default {
  name: 'ApostrophePiecesInsertModal',
  props: {
    moduleName: String
  },
  computed: {
    moduleOptions() {
      return window.apos.modules[this.moduleName];
    }
  },
  data() {
    // TODO we should get the initial pieceInfo from the server's
    // newInstance method so it has proper defaults etc.
    return {
      pieceInfo: {
        data: {},
        hasErrors: false
      }
    };
  },
  methods: {
    async save() {
      apos.bus.$emit('busy', true);
      try {
        await apos.http.post(this.moduleOptions.action, {
          busy: true,
          body: this.pieceInfo.data
        });
        this.$emit('saved');
      } finally {
        apos.bus.$emit('busy', false);
      }
    }
  }
};
</script>
