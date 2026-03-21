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
      >
        <ul
          ref="selectEl"
          class="apos-input apos-input--select apos-combo-filter__select"
          :class="{ 'apos-combo-filter__select--has-tags': selected.length }"
          role="button"
          :aria-expanded="isOpen.toString()"
          tabindex="0"
          @click="toggle"
          @keydown.prevent.space="toggle"
          @keydown.prevent.enter="toggle"
          @keydown.escape="close"
        >
          <li
            v-if="!selected.length"
            class="apos-combo-filter__placeholder"
          >
            {{ $t('apostrophe:any') }}
          </li>
          <li
            v-for="val in selected"
            :key="val"
            class="apos-combo-filter__tag"
            @mousedown.stop.prevent="removeValue(val)"
            @click.stop
          >
            {{ choiceLabel(val) }}
            <AposIndicator
              icon="close-icon"
              :icon-size="10"
            />
          </li>
        </ul>
        <AposIndicator
          icon="menu-down-icon"
          class="apos-input-icon"
          :icon-size="20"
        />
        <!-- Dropdown list -->
        <ul
          v-show="isOpen"
          class="apos-combo-filter__list"
          :style="{ top: selectHeight + 'px' }"
        >
          <li
            class="apos-combo-filter__item"
            :class="{ focused: focusedIndex === -1 }"
            @mousedown.stop.prevent="clearSelection"
            @click.stop
            @mouseover="focusedIndex = -1"
          >
            <AposIndicator
              v-if="!selected.length"
              icon="check-bold-icon"
              class="apos-combo-filter__check"
              :icon-size="10"
            />
            {{ $t('apostrophe:any') }}
          </li>
          <li
            v-for="(choice, i) in choices"
            :key="choice.value"
            class="apos-combo-filter__item"
            role="menuitemcheckbox"
            :class="{ focused: focusedIndex === i }"
            @mousedown.stop.prevent="toggleChoice(choice)"
            @click.stop
            @mouseover="focusedIndex = i"
          >
            <AposIndicator
              v-if="selected.includes(choice.value)"
              icon="check-bold-icon"
              class="apos-combo-filter__check"
              :icon-size="10"
            />
            {{ choice.label }}
          </li>
        </ul>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script setup>
// Standalone multi-select combo for filter panels.
// Reuses the standard .apos-input / .apos-input--select / .apos-input-wrapper
// CSS classes so sizing, padding, modifiers (small, micro) all match the
// sibling AposInputSelect dropdowns automatically.
//
// Emits immediately on every selection change — the orchestrator's
// `excludeChoices` mechanism prevents this filter's choices from being
// refreshed, so the component stays mounted and the dropdown stays open.
import {
  computed, onBeforeUnmount, onMounted, ref
} from 'vue';

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
  // Accepted to avoid Vue "unknown prop" warnings — the parent
  // passes it for AposInputSelect compatibility.
  noBlurEmit: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([ 'update:modelValue' ]);

const uid = Math.random();
const root = ref(null);
const selectEl = ref(null);
const isOpen = ref(false);
const focusedIndex = ref(null);
const selectHeight = ref(0);

// Read directly from props — no local accumulation.
const choices = computed(() => props.field?.choices || []);
const selected = computed(() => props.modelValue?.data || []);

function choiceLabel(val) {
  const choice = choices.value.find(c => c.value === val);
  return choice?.label ?? val;
}

// Track select area height so the dropdown positions below it.
let resizeObserver;
onMounted(() => {
  resizeObserver = new ResizeObserver(([ entry ]) => {
    selectHeight.value = entry.target.offsetHeight;
  });
  if (selectEl.value) {
    resizeObserver.observe(selectEl.value);
  }
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  document.removeEventListener('mousedown', onDocumentMousedown, true);
});

// --- Open / Close ---

function open() {
  if (isOpen.value) {
    return;
  }
  isOpen.value = true;
  focusedIndex.value = 0;
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

// Close on any mousedown outside the component root (capture phase).
function onDocumentMousedown(event) {
  if (root.value && !root.value.contains(event.target)) {
    close();
  }
}

// --- Selection (emit immediately on every change) ---

function emitSelection(data) {
  emit('update:modelValue', { data });
}

function toggleChoice(choice) {
  const current = selected.value;
  const next = current.includes(choice.value)
    ? current.filter(v => v !== choice.value)
    : [ ...current, choice.value ];
  emitSelection(next);
}

function removeValue(val) {
  emitSelection(selected.value.filter(v => v !== val));
}

function clearSelection() {
  emitSelection([]);
}
</script>

<style lang="scss" scoped>

.apos-combo-filter__select {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  gap: 4px;
  list-style: none;
  cursor: pointer;

  // When tags are present, reduce padding so total height stays close.
  &--has-tags {
    padding: 7px 30px 7px 8px;
  }
}

.apos-combo-filter__placeholder {
  pointer-events: none;
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
  left: 0;
  width: 100%;
  max-height: 300px;
  margin: 0;
  padding-left: 0;
  list-style: none;
  overflow-y: auto;
  background-color: var(--a-white);
  box-shadow: 0 0 3px var(--a-base-2);
  border-radius: var(--a-border-radius);
}

.apos-combo-filter__item {
  @include type-base;

  & {
    position: relative;
    padding: 10px 10px 10px 20px;
    cursor: pointer;
  }

  &.focused {
    background-color: var(--a-base-9);
  }
}

.apos-combo-filter__check {
  position: absolute;
  left: 5px;
}
</style>
