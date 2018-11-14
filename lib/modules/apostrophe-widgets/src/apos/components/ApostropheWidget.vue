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
  data() {
    return {
      rendered: '...'
    }
  },
  mounted: async function() {
    this.rendered = await axios.create({
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
  }
}

</script>