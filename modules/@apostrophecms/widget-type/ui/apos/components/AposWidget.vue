<!-- eslint-disable vue/no-v-html -->
<template>
  <div
    :class="getClasses()"
    v-html="rendered"
  />
</template>

<script>
// This component renders a widget in the editor. It is not involved
// when the user does not have editing privileges.

import AposWidgetMixin from 'Modules/@apostrophecms/widget-type/mixins/AposWidgetMixin';

export default {
  name: 'AposWidget',
  mixins: [ AposWidgetMixin ]
};

</script>

<style scoped>
/* TODO: change default placeholder style */
.apos-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--a-primary-light-40);
}
</style>
