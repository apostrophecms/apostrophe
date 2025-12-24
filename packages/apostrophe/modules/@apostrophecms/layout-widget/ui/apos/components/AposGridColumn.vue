<template>
  <component
    :is="props.tag"
    :id="widgetId"
    ref="columnEl"
    :style="itemStyles"
    :class="widgetStyles.classes"
    class="apos-layout__item"
    role="gridcell"
    data-apos-test="aposLayoutItem"
    :data-id="item._id"
    :data-tablet-full="props.tabletFullItems[item._id] || false"
    :data-visible-tablet="item.tablet?.show"
    :data-visible-mobile="item.mobile?.show"
  >
    <slot />
  </component>
</template>

<script setup>
import {
  useTemplateRef, computed, onMounted, watch
} from 'vue';
import { useAposStyles } from 'Modules/@apostrophecms/styles/composables/AposStyles.js';

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  tag: {
    type: String,
    default: 'div'
  },
  tabletFullItems: {
    type: Object,
    required: true
  }
});
const columnEl = useTemplateRef('columnEl');
const itemStyles = computed(() => {
  return [
    {
      '--colstart': props.item.colstart,
      '--colspan': props.item.colspan,
      '--rowstart': props.item.rowstart,
      '--rowspan': props.item.rowspan,
      '--order': props.item.order,
      '--justify': props.item.justify,
      '--align': props.item.align
    },
    widgetStyles.inline
  ];
});
const moduleOptions = apos.modules[apos.area.widgetManagers[props.item.type]];
const {
  widgetStyles,
  widgetId,
  getWidgetStyles,
  recomputeChangedStyles
} = useAposStyles();

watch(() => props.item, (newVal, oldVal) => {
  recomputeChangedStyles(newVal, oldVal, { moduleOptions });
});

defineExpose({
  columnEl
});

onMounted(() => {
  getWidgetStyles(props.item, moduleOptions);
});
</script>
