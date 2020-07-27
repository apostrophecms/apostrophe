<template>
  <ApostropheFieldset :field="field" :error="error">
    <template slot="body">
      <input type="radio" :id="uid + '-true'" :value="true" v-model="next">
      <label :for="uid + '-true'">Yes</label>
      <input type="radio" :id="uid + '-false'" :value="false" v-model="next">
      <label :for="uid + '-false'">No</label>
    </template>
  </ApostropheFieldset>
</template>

<script>

import ApostropheFieldMixin from '../mixins/ApostropheFieldMixin.js';

export default {
  mixins: [ ApostropheFieldMixin ],
  name: 'ApostropheBooleanField',
  methods: {
    validate(value) {
      if (this.field.mandatory) {
        if (!value) {
          return 'mandatory';
        }
      }
      return false;
    }
  }
};
</script>
