<template>
  <component
    :is="props.tag"
    ref="items"
    class="apos-layout__item"
    role="gridcell"
    data-apos-test="aposManageLayoutItem"
    :data-id="item._id"
    :style="{
      '--colstart': item.colstart,
      '--colspan': item.colspan,
      '--rowstart': item.rowstart,
      '--rowspan': item.rowspan,
      '--order': item.order,
      '--justify': item.justify,
      '--align': item.align,
    }"
  >
    <slot />
  </component>
</template>

<script setup>
const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  tag: {
    type: String,
    default: 'div'
  }
});

</script>

<style lang="scss">

</style>
