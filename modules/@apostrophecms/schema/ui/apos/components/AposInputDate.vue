<template>
  <AposInputString
    type="date"
    @input="input"
    :field="field"
    :status="status"
    :value="value"
  />
</template>

<script>
import AposInputMixin from '../mixins/AposInputMixin';

export default {
  name: 'AposInputDate',
  mixins: [ AposInputMixin ],
  methods: {
    input(value) {
      this.next = value.data;
      this.error = value.error;
    },
    validate() {
      return false;
    }
  }
};
</script>
