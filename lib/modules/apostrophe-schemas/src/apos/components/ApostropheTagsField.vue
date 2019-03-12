<template>
  <ApostropheFieldset :field="field" :error="error">
    <template slot="body">
      <p>TODO: implement tags field</p>
    </template>
  </ApostropheFieldset>
</template>

<script>

import ApostropheFieldMixin from '../mixins/ApostropheFieldMixin.js';

export default {
  mixins: [ ApostropheFieldMixin ],
  name: 'ApostropheTagsField',
  data() {
    return {
      next: []
    };
  },
  methods: {
    validate(value) {
      return false;
    }
  }
};
</script>
