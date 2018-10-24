<template>
  <ApostropheModal @close="$emit('close')">
    <template slot="header">
      <!-- TODO i18n -->
      <p>New {{ options.label }}</p>
    </template>
    <template slot="body">
      <ApostropheSchemaEditor :fields="options.schema" v-model="piece" />
    </template>
    <template slot="footer">
      <slot name="footer">
        <button class="modal-default-button" @click="$emit('close')">
          Cancel
        </button>
        <button class="modal-default-button" @click="save()">
          Save
        </button>
      </slot>
    </template>
  </ApostropheModal>
</template>

<script>

import axios from 'axios';
import cookies from 'js-cookie';

export default {
  name: 'ApostrophePiecesInsertModal',
  props: {
    moduleName: String
  },
  computed: {
    options() {
      return window.apos.modules[this.moduleName];
    }
  },
  data() {
    return {
      piece: {}
    };
  },
  methods: {
    async save() {
      apos.bus.$emit('busy', true);
      try {
        await axios.create({
          headers: {
            'X-XSRF-TOKEN': cookies.get(window.apos.csrfCookieName)
          }
        }).post(
          this.options.action + '/insert',
          this.piece
        );
        $this.$emit('saved');
      } finally {
        apos.bus.$emit('busy', false);
      }
    }
  }
};
</script>
