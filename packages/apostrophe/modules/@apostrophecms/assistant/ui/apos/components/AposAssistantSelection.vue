<template>
  <div
    v-if="chips.length"
    ref="row"
    class="apos-assistant-selection"
    role="group"
    :aria-label="$t('apostrophe:assistantSelection')"
    data-apos-test="assistant-selection"
  >
    <AposAssistantChip
      v-for="chip in chips"
      :key="chip.id"
      :title="chip.label"
      kind="widget"
      :remove-label="$t('apostrophe:assistantDeselect', { label: chip.label })"
      :action-label="$t('apostrophe:assistantShowWidget', { label: chip.label })"
      data-apos-test="assistant-selection-chip"
      @remove="deselect(chip.id, $event)"
      @action="show(chip.id)"
    />
  </div>
</template>

<script setup>
// One chip per widget selected on the page, however it was selected: the
// chips are the widget store's selection, so removing one deselects it, and
// a click on one shows its widget
import {
  computed, inject, nextTick, ref
} from 'vue';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget';
import { widgetElement } from 'Modules/@apostrophecms/area/lib/widget-selection-dom.js';
import { dropFromSelection } from 'Modules/@apostrophecms/area/lib/batch-widgets.js';
import AposAssistantChip from './AposAssistantChip.vue';

const emit = defineEmits([ 'empty' ]);
const widgetStore = useWidgetStore();
const $t = inject('i18n');
const row = ref(null);

const chips = computed(() => {
  const scope = widgetStore.selectionScope || document;
  return widgetStore.selectedWidgetIds.map(id => {
    const type = widgetElement(id, scope)?.getAttribute('data-apos-widget-type');
    const label = type && window.apos.modules[`${type}-widget`]?.label;
    return {
      id,
      label: $t(label || 'apostrophe:assistantWidget')
    };
  });
});

// Scrolled to when out of view, as `show_widgets` does, then flashed: focus
// stays in the composer
function show(id) {
  const element = widgetElement(id, widgetStore.selectionScope || document);
  if (!element) {
    return;
  }
  if (!widgetStore.isElementInView(element)) {
    widgetStore.scrollToElement(element);
  }
  widgetStore.flashElement(element);
}

// Focus on the removed chip's button moves to the next chip, else the one
// before, else to the text
async function deselect(id, event) {
  const focused = document.activeElement === event.currentTarget;
  const index = chips.value.findIndex(chip => chip.id === id);
  dropFromSelection([ id ]);
  if (!focused) {
    return;
  }
  await nextTick();
  const buttons = row.value?.querySelectorAll('.apos-assistant-chip__remove') || [];
  const next = buttons[index] || buttons[index - 1];
  if (next) {
    next.focus();
  } else {
    emit('empty');
  }
}
</script>

<style lang="scss" scoped>
  .apos-assistant-selection {
    display: flex;
    flex-wrap: wrap;
    padding: 2px 5px 0;
    gap: 4px;
  }
</style>
