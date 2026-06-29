<template>
  <div class="apos-font-size-control">
    <AposContextMenu
      ref="contextMenu"
      menu-placement="bottom-end"
      :center-tip-el="centerTipEl"
      :rich-text-menu="true"
      @open="openPopover"
      @close="closePopover"
      @keyup-enter="onKeyupEnter"
    >
      <template #button="btnProps">
        <AposButton
          type="rich-text"
          class="apos-font-size-button apos-rich-text-editor__control"
          :icon-only="false"
          icon="format-size-icon"
          :label="tool.label"
          :modifiers="['no-border', 'no-motion']"
          :tooltip="{
            content: tool.label,
            placement: 'top',
            delay: 650
          }"
          @click="btnProps.onClick"
        >
          <template #label>
            <AposIndicator
              ref="centerTipEl"
              icon="chevron-down-icon"
              class="apos-font-size-button__chevron"
            />
          </template>
        </AposButton>
      </template>
      <div
        class="apos-popover apos-font-size-control__dialog"
        :class="{ 'apos-has-selection': hasSelection }"
      >
        <div
          v-if="hasFontSize"
          class="apos-font-size-control__remove"
        >
          <AposButton
            type="quiet"
            label="apostrophe:richTextRemoveFontSize"
            @click="clear"
          />
        </div>
        <div class="apos-font-size-control__body">
          <label class="apos-font-size-control__label">
            {{ $t('apostrophe:richTextFontSize') }}
          </label>
          <div class="apos-font-size-control__inputs">
            <input
              v-model.number="amount"
              class="apos-font-size-control__amount"
              :class="{ 'apos-font-size-control__amount--no-spinners': isEmpty }"
              type="number"
              min="1"
              step="1"
              :aria-label="$t('apostrophe:richTextFontSize')"
              @input="applyControls"
            >
            <span class="apos-font-size-control__suffix">px</span>
          </div>
          <ul
            v-if="presets.length"
            class="apos-font-size-control__presets"
          >
            <li
              v-for="preset in presets"
              :key="preset"
            >
              <AposButton
                type="quiet"
                :label="presetLabel(preset)"
                :modifiers="['no-motion']"
                @click="applyPreset(preset)"
              />
            </li>
          </ul>
        </div>
        <footer class="apos-font-size-control__footer">
          <AposButton
            type="primary"
            label="apostrophe:close"
            :modifiers="['small', 'margin-micro']"
            @click="close"
          />
        </footer>
      </div>
    </AposContextMenu>
  </div>
</template>

<script setup>
import {
  ref, watch, computed
} from 'vue';

const props = defineProps({
  editor: {
    type: Object,
    required: true
  },
  tool: {
    type: Object,
    required: true
  },
  options: {
    type: Object,
    default: () => ({})
  },
  modelValue: {
    type: Object,
    default: () => ({})
  }
});
const emit = defineEmits([ 'open-popover', 'close' ]);

const moduleOptions = window.apos.modules['@apostrophecms/rich-text-widget'];

// Font sizes are always in pixels. Keeping a single unit avoids a confusing
// unit picker and keeps server-side validation simple.
const defaultPresets = [ 12, 14, 16, 18, 24, 32, 48 ];

const amount = ref(null);
const hasFontSize = ref(false);
const contextMenu = ref(null);
const centerTipEl = ref(null);

const presets = computed(() => {
  const merged = {
    ...moduleOptions,
    ...props.options
  };
  return Array.isArray(merged.fontSizes) ? merged.fontSizes : defaultPresets;
});
const hasSelection = computed(() => !props.editor.state.selection.empty);
// While the field is blank we hide the native up/down arrows, otherwise a
// first tap would snap an empty field to 1 rather than a sensible size.
const isEmpty = computed(() => {
  return amount.value === null || amount.value === undefined || amount.value === '';
});

// Extract a pixel number from a preset (12, '12' or '12px') or from a stored
// CSS value such as "16px". Returns null when there is no usable number.
function toPxNumber(value) {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  const match = String(value).trim().match(/^([\d.]+)(?:px)?$/i);
  return match ? parseFloat(match[1]) : null;
}

function presetLabel(preset) {
  const number = toPxNumber(preset);
  return number != null ? String(number) : String(preset);
}

watch(
  () => props.editor.state.selection,
  () => {
    const raw = props.editor.getAttributes('textStyle').fontSize;
    amount.value = toPxNumber(raw);
    hasFontSize.value = raw != null && raw !== '';
  },
  {
    deep: true,
    immediate: true
  }
);

function openPopover() {
  emit('open-popover');
}
function closePopover() {
  emit('close');
}
function onKeyupEnter(event) {
  if (event.key === 'Enter') {
    close();
  }
}

// Apply the mark without stealing focus from the popover controls. As with
// the color tool, tiptap applies the mark to the editor's current selection
// regardless of where DOM focus currently sits.
function setFontSize(pixels) {
  props.editor.chain().setFontSize(`${pixels}px`).run();
}

function applyControls() {
  if (amount.value == null || Number.isNaN(amount.value) || amount.value <= 0) {
    return;
  }
  setFontSize(amount.value);
}

function applyPreset(preset) {
  const number = toPxNumber(preset);
  if (number == null) {
    return;
  }
  amount.value = number;
  setFontSize(number);
}

function clear() {
  props.editor.commands.unsetFontSize();
  props.editor.chain().focus().blur().run();
  close();
}

function close() {
  if (contextMenu.value) {
    props.editor.chain().focus().blur().run();
    contextMenu.value.hide();
  }
}
</script>

<style lang="scss" scoped>
.apos-font-size-control {
  position: relative;
  display: inline-block;
}

.apos-font-size-button__chevron {
  margin-left: 2px;
}

.apos-font-size-control__dialog {
  &.apos-is-triggered.apos-has-selection {
    opacity: 1;
    pointer-events: auto;
  }
}

.apos-font-size-control__remove {
  display: flex;
  justify-content: flex-end;
}

.apos-font-size-control__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 180px;
}

.apos-font-size-control__label {
  @include type-label;

  & {
    color: var(--a-base-2);
  }
}

.apos-font-size-control__inputs {
  display: flex;
  align-items: center;
  gap: 6px;
}

.apos-font-size-control__amount {
  width: 80px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--a-base-7);
  border-radius: var(--a-border-radius);
  background-color: var(--a-background-primary);
  color: var(--a-text-primary);
  font-family: var(--a-family-default);
  font-size: var(--a-type-base);

  &:focus {
    outline: none;
    border-color: var(--a-primary);
  }
}

// Suppress the native number spinner until there is a value to step from.
.apos-font-size-control__amount--no-spinners {
  /* stylelint-disable-next-line property-no-vendor-prefix */
  -moz-appearance: textfield;
  appearance: textfield;

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    margin: 0;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    appearance: none;
  }
}

.apos-font-size-control__suffix {
  color: var(--a-base-2);
  font-size: var(--a-type-base);
}

.apos-font-size-control__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.apos-font-size-control__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
</style>
