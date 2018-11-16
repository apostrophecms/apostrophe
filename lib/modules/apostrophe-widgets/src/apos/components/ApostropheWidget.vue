<template>
  <div v-html="rendered"></div>
</template>

<script>

import axios from 'axios';
import cookies from 'js-cookie';

export default {
  name: 'ApostropheWidget',
  props: {
    type: String,
    options: Object,
    value: Object,
    docId: String
  },
  watch: {
    value: {
      deep: true,
      handler() {
        this.renderContent();
      }
    }
  },
  data() {
   return {
      rendered: '...'
    }
  },
  mounted: function() {
    this.renderContent();
  },
  methods: {
    async renderContent() {
      const response = await axios.create({
        headers: {
          'X-XSRF-TOKEN': cookies.get(window.apos.csrfCookieName)
        }
      }).post(
        apos.areas.action + '/render-widget',
        {
          widget: this.value,
          options: this.options,
          type: this.type,
          docId: this.docId
        }
      );
      this.rendered = response.data;
      // Wait for reactivity to populate v-html so the
      // ApostropheAreas manager can spot any new area divs
      setImmediate(function() {
        apos.bus.$emit('widgetChanged');
      });
    }
  }
}

</script>