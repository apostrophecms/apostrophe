<template>
  <ul v-if="visible">
    <li>Test</li>
    <li>Test 2</li>
  </ul>
</template>

<script>
// import AposInputMixin from '../mixins/AposInputMixin.js';

export default {
  name: 'AposSearchList',
  // mixins: [ AposInputMixin ],
  props: {
    visible: {
      type: Boolean
    }
  },
}
</script>
