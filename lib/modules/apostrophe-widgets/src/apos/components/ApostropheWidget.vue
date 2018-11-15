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
    value: Object
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
    console.log('value in widget: ', this.value);
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
          type: this.type
        }
      );
      this.rendered = response.data;
    }
  }
}

</script>