<template>
  <ApostropheModal @close="$emit('close')">
    <template slot="header">
      <!-- TODO i18n -->
      <p>New {{ options.label }}</p>
    </template>
    <template slot="body">
      <ApostropheSchemaEditor :fields="options.schema" v-model="pieceInfo" />
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

import axios from 'axios';
import cookies from 'js-cookie';
import _ from 'lodash';

export default {
  name: 'ApostrophePiecesInsertModal',
  props: {
    moduleName: String
  },
  computed: {
    options() {
      return {
        label: 'Products',
        schema: [
          {
            type: 'string',
            name: 'name',
            label: 'Name',
            required: true
          },
          {
            type: 'string',
            name: 'address',
            label: 'Address'
          },
          {
            type: 'string',
            name: 'message',
            label: 'Message',
            required: true,
            min: 10,
            max: 20
          }
        ]
      };
      // return window.apos.modules[this.moduleName];
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
      console.log(this.pieceInfo.data);
      return;
      apos.bus.$emit('busy', true);
      try {
        await axios.create({
          headers: {
            'X-XSRF-TOKEN': cookies.get(window.apos.csrfCookieName)
          }
        }).post(
          this.options.action + '/insert',
          this.pieceInfo.data
        );
        $this.$emit('saved');
      } finally {
        apos.bus.$emit('busy', false);
      }
    }
  }
};
</script>
