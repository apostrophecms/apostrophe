<template>
  <AposInputWrapper
    :field="field"
    :error="null"
    :uid="uid"
    :modifiers="modifiers"
    :display-options="{}"
  >
    <template #body>
      <div
        ref="root"
        class="apos-input-wrapper"
        :class="modifierClasses"
        @keyup.esc="onEscKeyup"
      >
        <ul
          ref="selectEl"
          class="apos-input apos-input--select apos-combo-filter__select"
          :class="{ 'apos-combo-filter__select--has-tags': selected.length }"
          role="combobox"
          :aria-expanded="isOpen.toString()"
          aria-haspopup="listbox"
          :aria-owns="listId"
          :aria-activedescendant="activeDescendantId"
          :aria-label="$t(field.label || 'apostrophe:filter')"
          tabindex="0"
          @click="toggle"
          @keydown="onKeydown"
        >
          <li
            v-if="!selected.length"
            class="apos-combo-filter__placeholder"
            aria-hidden="true"
          >
            {{ $t('apostrophe:any') }}
          </li>
          <li
            v-for="(val, tagIndex) in selected"
            :key="val"
            class="apos-combo-filter__tag"
            tabindex="0"
            role="button"
            :aria-label="`${choiceLabel(val)} — ${$t('apostrophe:remove')}`"
            @mousedown.stop.prevent="removeValue(val)"
            @click.stop
            @keydown="onTagKeydown($event, val, tagIndex)"
          >
            {{ choiceLabel(val) }}
            <AposIndicator
              icon="close-icon"
              :icon-size="10"
              aria-hidden="true"
            />
          </li>
        </ul>
        <AposIndicator
          icon="plus-icon"
          class="apos-input-icon"
          :icon-size="14"
          :title="$t(addLabel)"
          aria-hidden="true"
        />
        <!-- Dropdown: only unselected choices -->
        <ul
          v-show="isOpen"
          :id="listId"
          class="apos-combo-filter__list"
          role="listbox"
          :aria-label="$t(field.label || 'apostrophe:filter')"
        >
          <li
            :id="optionId(-1)"
            class="apos-combo-filter__item"
            role="option"
            :aria-selected="(!selected.length).toString()"
            :class="{ 'is-focused': focusedIndex === -1 }"
            @mousedown.stop.prevent="clearAndClose"
            @click.stop
            @mouseover="focusedIndex = -1"
          >
            {{ $t('apostrophe:any') }}
          </li>
          <li
            v-for="(choice, i) in availableChoices"
            :id="optionId(i)"
            :key="choice.value"
            class="apos-combo-filter__item"
            role="option"
            aria-selected="false"
            :class="{ 'is-focused': focusedIndex === i }"
            @mousedown.stop.prevent="addChoice(choice)"
            @click.stop
            @mouseover="focusedIndex = i"
          >
            {{ choice.label }}
          </li>
        </ul>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script setup>
// "Add-to-list" multi-select combo for filter panels.
// Reuses the standard .apos-input / .apos-input--select / .apos-input-wrapper
// CSS classes so sizing, padding, and modifiers (small, micro) all match the
// sibling AposInputSelect dropdowns automatically.
import {
  computed, nextTick, onBeforeUnmount, ref
} from 'vue';
import { createId } from '@paralleldrive/cuid2';

const props = defineProps({
  field: {
    type: Object,
    required: true
  },
  modelValue: {
    type: Object,
    required: true
  },
  status: {
    type: Object,
    default: () => ({})
  },
  modifiers: {
    type: Array,
    default: () => []
  },
  addLabel: {
    type: String,
    default: 'apostrophe:addItem'
  },
  // Accepted to avoid Vue "unknown prop" warnings — the parent
  // passes it for AposInputSelect compatibility.
  noBlurEmit: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([ 'update:modelValue' ]);

const uid = createId();
const listId = `combo-list-${uid}`;
const root = ref(null);
const selectEl = ref(null);
const isOpen = ref(false);
const focusedIndex = ref(null);
const escConsumed = ref(false);

const choices = computed(() => props.field?.choices || []);
const selected = computed(() => props.modelValue?.data || []);

const modifierClasses = computed(() =>
  props.modifiers.reduce((acc, mod) => {
    acc[`apos-combo-filter--${mod}`] = true;
    return acc;
  }, {})
);

const availableChoices = computed(() =>
  choices.value.filter(c => !selected.value.includes(c.value))
);

function optionId(index) {
  return `${listId}-opt-${index}`;
}

const activeDescendantId = computed(() => {
  if (!isOpen.value || focusedIndex.value == null) {
    return undefined;
  }
  return optionId(focusedIndex.value);
});

function choiceLabel(val) {
  const choice = choices.value.find(c => c.value === val);
  return choice?.label ?? val;
}

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMousedown, true);
});

// --- Open / Close ---

function open() {
  if (isOpen.value) {
    return;
  }
  isOpen.value = true;
  focusedIndex.value = -1;
  document.addEventListener('mousedown', onDocumentMousedown, true);
}

function close() {
  if (!isOpen.value) {
    return;
  }
  isOpen.value = false;
  focusedIndex.value = null;
  document.removeEventListener('mousedown', onDocumentMousedown, true);
}

function toggle() {
  isOpen.value ? close() : open();
}

function onDocumentMousedown(event) {
  if (root.value && !root.value.contains(event.target)) {
    close();
  }
}

// --- Keyboard navigation ---

function onKeydown(event) {
  const { key } = event;

  if (key === 'Escape') {
    if (isOpen.value) {
      event.preventDefault();
      event.stopPropagation();
      escConsumed.value = true;
      close();
    }
    return;
  }

  if (key === 'Tab') {
    close();
    return;
  }

  if (!isOpen.value) {
    if (key === ' ' || key === 'Enter' || key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      open();
    }
    return;
  }

  // Dropdown is open — navigate or select.
  const maxIndex = availableChoices.value.length - 1;

  if (key === 'ArrowDown') {
    event.preventDefault();
    if (focusedIndex.value == null || focusedIndex.value >= maxIndex) {
      focusedIndex.value = -1;
    } else {
      focusedIndex.value++;
    }
    scrollFocusedIntoView();
    return;
  }

  if (key === 'ArrowUp') {
    event.preventDefault();
    if (focusedIndex.value == null || focusedIndex.value <= -1) {
      focusedIndex.value = maxIndex;
    } else {
      focusedIndex.value--;
    }
    scrollFocusedIntoView();
    return;
  }

  if (key === ' ' || key === 'Enter') {
    event.preventDefault();
    selectFocused();
  }
}

function onEscKeyup(event) {
  if (escConsumed.value) {
    event.stopPropagation();
    escConsumed.value = false;
  }
}

function scrollFocusedIntoView() {
  const el = root.value?.querySelector(`#${optionId(focusedIndex.value)}`);
  el?.scrollIntoView({ block: 'nearest' });
}

function selectFocused() {
  if (focusedIndex.value === -1) {
    clearAndClose();
  } else if (
    focusedIndex.value != null &&
    focusedIndex.value >= 0 &&
    focusedIndex.value < availableChoices.value.length
  ) {
    addChoice(availableChoices.value[focusedIndex.value]);
  }
}

// --- Selection ---

function emitSelection(data) {
  emit('update:modelValue', { data });
}

function addChoice(choice) {
  emitSelection([ ...selected.value, choice.value ]);
  close();
}

function removeValue(val) {
  emitSelection(selected.value.filter(v => v !== val));
}

function removeValueAndRefocus(val, tagIndex) {
  const newSelected = selected.value.filter(v => v !== val);
  emitSelection(newSelected);
  nextTick(() => {
    const tags = root.value?.querySelectorAll('.apos-combo-filter__tag');
    if (!tags || tags.length === 0) {
      selectEl.value?.focus();
    } else if (tagIndex < tags.length) {
      tags[tagIndex].focus();
    } else {
      tags[tags.length - 1].focus();
    }
  });
}

function onTagKeydown(event, val, tagIndex) {
  const { key } = event;
  if (key === ' ' || key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    removeValueAndRefocus(val, tagIndex);
    return;
  }
  // Prevent arrow keys from bubbling to combobox handler
  // and from scrolling the page behind.
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    event.preventDefault();
    event.stopPropagation();
  }
}

function clearAndClose() {
  emitSelection([]);
  close();
}
</script>

<style lang="scss" scoped>

.apos-combo-filter__select {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  padding-right: $input-padding + 20px;
  gap: 4px;
  list-style: none;
  cursor: pointer;
  user-select: none;

  &--has-tags {
    padding: ($input-padding - $spacing-half) ($input-padding + 20px) ($input-padding - $spacing-half) ($input-padding - $spacing-half);
  }
}

// --- Modifier overrides (small, small+inline) ---

.apos-combo-filter--small {
  .apos-combo-filter__select--has-tags {
    padding: $spacing-half ($input-padding + 20px) $spacing-half $spacing-three-quarters;
  }
}

.apos-combo-filter--small.apos-combo-filter--inline {
  .apos-combo-filter__select {
    padding-right: $spacing-half + 20px;
  }

  .apos-combo-filter__select--has-tags {
    padding: $spacing-one-quarter ($spacing-half + 20px) $spacing-one-quarter $spacing-three-quarters;
  }
}

.apos-combo-filter__placeholder {
  pointer-events: none;
}

// Adapt the icon wrapper so that we have the standard dropdown
// 20x20 area, while our icon is 14x14 (because it looks weirdly huge at 20x20).
:deep(.apos-input-icon) {
  width: 20px;
  height: 20px;
}

.apos-combo-filter__tag {
  @include type-base;

  & {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 8px;
    border: 1px solid var(--a-base-8);
    border-radius: var(--a-border-radius);
    background-color: var(--a-white);
    cursor: pointer;
  }

  &:hover {
    border-color: var(--a-base-3);
    background-color: var(--a-base-8);
  }

  :deep(.apos-indicator) {
    width: 10px;
    height: 10px;
  }
}

.apos-combo-filter__list {
  z-index: $z-index-manager-display;
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  max-height: 300px;
  margin: 0;
  padding-left: 0;
  list-style: none;
  overflow-y: auto;
  user-select: none;
  background-color: var(--a-white);
  box-shadow: 0 0 3px var(--a-base-2);
  border-radius: var(--a-border-radius);
}

.apos-combo-filter__item {
  @include type-base;

  & {
    padding: 10px;
    cursor: pointer;
  }

  &.is-focused {
    background-color: var(--a-base-9);
  }
}
</style>
