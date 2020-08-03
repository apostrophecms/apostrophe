<template>
  <ApostropheModal @close="$emit('close')">
    <template slot="header">
      <!-- TODO i18n -->
      <p>New {{ moduleOptions.label }}</p>
    </template>
    <template slot="body">
      <ApostropheSchemaEditor :fields="moduleOptions.schema" v-model="pieceInfo" :docId="virtualDocId" />
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
import patch from 'Modules/@apostrophecms/area/lib/patch';

export default {
  name: 'ApostrophePiecesInsertModal',
  props: {
    moduleName: {
      type: String,
      required: true
  },
  data() {
    const pieceInfo = {
      data: {},
      hasErrors: false
    };
    return {
      pieceInfo,
      virtualDocId: patch.memoryDoc(pieceInfo)
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.modules[this.moduleName];
    }
  },
  methods: {
    async save() {
      apos.bus.$emit('busy', true);
      try {
        Object.assign(this.pieceInfo, )
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
