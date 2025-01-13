<template>
  <div class="apos-color-control">
    <AposButton
      type="rich-text"
      class="apos-rich-text-editor__control"
      :class="['apos-color-button', { 'apos-is-active': active }]"
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
      @click="click"
    >
      <template #label>
        <AposIndicator icon="chevron-down-icon" />
      </template>
    </AposButton>
    <div
      v-if="active"
      v-click-outside-element="close"
      class="apos-popover apos-color-control__dialog"
      x-placement="bottom"
      :class="{
        'apos-is-triggered': active,
        'apos-has-selection': hasSelection
      }"
    >
      <AposContextMenuDialog menu-placement="bottom-center">
        <div
          v-if="editor"
          class="text-color-component"
          @mousedown="handleMouseDown"
        >
          <AposColor
            :options="userOptions"
            :model-value="pickerValue"
            @update:model-value="update"
            @focus="focus"
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
      </AposContextMenuDialog>
    </div>
  </div>
</template>

<script>
import {
  ref, watch, computed, defineComponent
} from 'vue';

export default defineComponent({
  name: 'AposTiptapColor',
  props: {
    name: {
      type: String,
      required: true
    },
    options: {
      type: Object,
      required: true
    },
    tool: {
      type: Object,
      required: true
    },
    modelValue: {
      type: Object,
      default() {
        return {};
      }
    },
    editor: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const active = ref(false);
    const next = ref('');
    const indicatorColor = ref('#000000');

    const projectOptions = computed(() => {
      return window.apos.modules['@apostrophecms/rich-text-widget'];
    });

    const areaOptions = props.options || {};

    const userOptions = computed(() => {
      const options = {
        ...projectOptions.value,
        ...areaOptions
      };
      return options.color;
    });

    const pickerValue = ref(next.value || '');

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

    watch(pickerValue, (newColor) => {
      indicatorColor.value = newColor;
    });

    const open = () => {
      active.value = true;
    };

    const close = () => {
      active.value = false;
    };

    const update = (value) => {
      next.value = value;
      props.editor.chain().focus().setColor(value).run();
      indicatorColor.value = next.value;
    };

    const click = () => {
      active.value = !active.value;
    };

    const focus = () => {
      // Keep focus on the toolbar to prevent it from closing
      props.editor.view.dom.focus();
    };

    const handleMouseDown = (event) => {
      const target = event.target;
      if (
        target.closest('.apos-color__saturation-wrap') ||
        target.closest('.apos-color__presets') ||
        target.closest('.apos-color__controls')
      ) {
        event.preventDefault();
      } else {
        props.editor.view.dom.focus();
      }
    };

    return {
      active,
      indicatorColor,
      userOptions,
      pickerValue,
      hasSelection,
      open,
      close,
      update,
      click,
      focus,
      handleMouseDown
    };
  }
});
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
  z-index: $z-index-modal;
  position: absolute;
  top: calc(100% + 15px);
  left: 5px;
  opacity: 0;
  pointer-events: none;
  width: auto;
  max-width: 90%;

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
</style>
