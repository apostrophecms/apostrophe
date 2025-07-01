<template>
  <div class="apos-color-control">
    <AposContextMenu
      ref="contextMenu"
      menu-placement="bottom-end"
      :center-tip-el="centerTipEl"
      :rich-text-menu="true"
      @open="openPopover"
      @close="closePopover"
    >
      <template #button="btnProps">
        <AposButton
          type="rich-text"
          class="apos-color-button apos-rich-text-editor__control"
          :icon-only="false"
          icon="circle-icon"
          :icon-fill="indicatorColor"
          :label="'apostrophe:richTextColor'"
          :modifiers="['no-border', 'no-motion']"
          :tooltip="{
            content: 'apostrophe:richTextColor',
            placement: 'top',
            delay: 650
          }"
          @click="btnProps.onClick"
        >
          <template #label>
            <AposColorCheckerboard class="apos-color-control__checkerboard" />
            <AposIndicator
              ref="centerTipEl"
              icon="chevron-down-icon"
            />
          </template>
        </AposButton>
      </template>
      <div
        class="apos-popover apos-color-control__dialog"
        :class="{ 'apos-has-selection': hasSelection }"
      >
        <div class="text-color-component">
          <AposColor
            :options="userOptions"
            :model-value="next"
            @update:model-value="update"
          />
        </div>
        <footer class="apos-color-control__footer">
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

const next = ref('');
const indicatorColor = ref('#000000');
const contextMenu = ref(null);
const centerTipEl = ref(null);

const userOptions = computed(() => {
  const options = {
    ...moduleOptions,
    ...props.options
  };
  return options.color;
});
const hasSelection = computed(() => !props.editor.state.selection.empty);

watch(
  () => props.editor.state.selection,
  () => {
    if (hasSelection.value) {
      const newColor = props.editor.getAttributes('textStyle').color;
      next.value = newColor || '#000000';
      indicatorColor.value = next.value;
    } else {
      next.value = '#000000';
      indicatorColor.value = next.value;
    }
  },
  {
    deep: true,
    immediate: true
  }
);

function openPopover() {
  addEventListener('keydown', keyboardHandler);
  emit('open-popover');
}
function closePopover() {
  removeEventListener('keydown', keyboardHandler);
  emit('close');
}
function keyboardHandler(e) {
  if ([ 'Escape', 'Enter' ].includes(e.key)) {
    close();
  }
}

function close() {
  if (contextMenu.value) {
    props.editor.chain().focus().blur().run();
    contextMenu.value.hide();
  }
};

function update(value) {
  next.value = value;
  indicatorColor.value = next.value;
  // Might be a temporary solution, but since it would require refacto
  // to pass an additional param saying if we're editing colors from an input
  // or no. mainly because we use a computed with getter and setter, so we just
  // can't pass params.
  if (document.activeElement.tagName === 'INPUT') {
    props.editor.chain().setColor(value).run();
  } else {
    props.editor.chain().focus().setColor(value).run();
  }
};
</script>

<style lang="scss" scoped>
.apos-color-control {
  position: relative;
  display: inline-block;
}

.apos-color-button {
  display: flex;
  align-items: center;
  border: none;
  background-color: transparent;
  cursor: pointer;
}

.color-indicator {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  margin-right: 5px;
  border-radius: 50%;
}

.button-label {
  margin-right: 5px;
}

.chevron-down {
  display: inline-block;
  padding: 3px;
  border: solid var(--a-base-8);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.apos-color-control__dialog {
  &.apos-is-triggered.apos-has-selection {
    opacity: 1;
    pointer-events: auto;
  }
}

.apos-is-active {
  background-color: var(--a-base-7);
}

.apos-color-control__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.apos-color-control__checkerboard {
  z-index: $z-index-under;
  position: absolute;
  top: 1.5px;
  left: 1.5px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  pointer-events: none;
}
</style>
