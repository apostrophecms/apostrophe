<template>
  <AposContextMenu
    ref="menu"
    class="apos-doc-locales"
    :button="button"
    :unpadded="true"
    menu-placement="bottom-end"
    @open="open"
  >
    <AposLocalePicker
      :current-locale="locale"
      :localized="localized"
      @switch-locale="switchLocale"
    />
  </AposContextMenu>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  locale: {
    type: String,
    required: true
  }
});

const localized = ref({});
const button = {
  label: {
    key: props.locale,
    localize: false
  },
  icon: 'chevron-down-icon',
  modifiers: [ 'icon-right', 'no-motion', 'uppercase' ],
  type: 'quiet'
};

async function open() {
  // TODO: We need to check in which locales the current document exist.
  // And to set localized based on that
};

function switchLocale() {
  // TODO: Implement
}
</script>

<style lang="scss">

</style>
