<template>
  <div class="apos-color-control">
    <AposButton
      type="rich-text"
      class="apos-rich-text-editor__control"
      :class="['apos-color-button', { 'apos-is-active': active }]"
      :icon-only="false"
      icon="circle-icon"
      :icon-fill="indicatorColor"
      :label="tool.label"
      :modifiers="['no-border', 'no-motion']"
      :tooltip="{
        content: tool.label,
        placement: 'top',
        delay: 650
      }"
      :style="{ color: indicatorColor }"
      @click="click"
      @mousedown.stop.prevent
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
      @mousedown.stop.prevent
    >
      <AposContextMenuDialog menu-placement="bottom-center">
        <div
          v-if="editor"
          class="text-color-component"
          @mousedown.stop.prevent
        >
          <Picker
            v-bind="pickerOptions"
            :model-value="pickerValue"
            @update:model-value="update"
            @mousedown.stop.prevent
            @focus="focus"
          />
        </div>
        <footer class="apos-color-control__footer">
          <AposButton
            type="primary"
            label="apostrophe:close"
            :modifiers="['small', 'margin-micro']"
            @click="close"
            @mousedown.stop.prevent
          />
        </footer>
      </AposContextMenuDialog>
    </div>
  </div>
</template>

<script>
import { ref, watch, computed, defineComponent } from 'vue';
import { Sketch as Picker } from '@ckpack/vue-color';
import tinycolor from 'tinycolor2';

export default defineComponent({
  name: 'AposTiptapColor',
  components: {
    Picker
  },
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
    const tinyColorObj = ref(null);
    const startsNull = ref(false);
    const indicatorColor = ref('#000000');

    const defaultOptions = {
      presetColors: [
        '#D0021B', '#F5A623', '#F8E71C', '#8B572A', '#7ED321',
        '#417505', '#BD10E0', '#9013FE', '#4A90E2', '#50E3C2',
        '#B8E986', '#000000', '#4A4A4A', '#9B9B9B', '#FFFFFF'
      ],
      disableAlpha: false,
      disableFields: false,
      format: 'hex8'
    };

    const projectOptions = computed(() => {
      return window.apos.modules['@apostrophecms/rich-text-widget'];
    });

    const areaOptions = props.options || {};

    const userOptions = computed(() => {
      return {
        ...projectOptions.value,
        ...areaOptions
      };
    });

    const mergedOptions = computed(() => {
      return {
        ...defaultOptions,
        ...userOptions.value.pickerOptions,
        presetColors: userOptions.value.pickerOptions?.presetColors || defaultOptions.presetColors,
        format: userOptions.value.format || defaultOptions.format
      };
    });

    const pickerOptions = computed(() => {
      const { presetColors, disableAlpha, disableFields } = mergedOptions.value;
      return { presetColors, disableAlpha, disableFields };
    });

    const format = computed(() => {
      return mergedOptions.value.format;
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
      { deep: true, immediate: true }
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
      console.log(value);
      tinyColorObj.value = tinycolor(value.hsl);
      next.value = tinyColorObj.value.toString(format.value);

      // original
      props.editor.chain().focus().setColor(next.value).run();

      // variations that don't work
      // props.editor.chain().focus().setColor(next.value).focus().run();
      // props.editor.chain().blur().setColor(next.value).focus().run();
      // props.editor.chain().focus().setColor(next.value).blur().run();
      // props.editor.chain().setColor(next.value).run();
      // props.editor.chain().blur().setMark('textStyle', { color: next.value }).focus().run();

      indicatorColor.value = next.value;
    };

    const click = () => {
      active.value = !active.value;
    };

    const focus = () => {
      // Keep focus on the toolbar to prevent it from closing
      props.editor.view.dom.focus();
    };

    return {
      active,
      indicatorColor,
      pickerOptions,
      pickerValue,
      hasSelection,
      startsNull,
      open,
      close,
      update,
      click,
      focus
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
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: 5px;
    flex-shrink: 0;
  }

  .button-label {
    margin-right: 5px;
  }

  .chevron-down {
    border: solid var(--a-base-8);
    border-width: 0 2px 2px 0;
    display: inline-block;
    padding: 3px;
    transform: rotate(45deg);
    -webkit-transform: rotate(45deg);
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
