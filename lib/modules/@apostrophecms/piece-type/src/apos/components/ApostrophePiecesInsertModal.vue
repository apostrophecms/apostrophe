<template>
  <ApostropheModal @close="$emit('close')">
    <template slot="header">
      <!-- TODO i18n -->
      <p>New {{ moduleOptions.label }}</p>
    </template>
    <template slot="body">
      <ApostropheSchemaEditor :fields="moduleOptions.schema" v-model="pieceInfo" />
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

import _ from 'lodash';

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
