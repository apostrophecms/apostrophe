<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="effectiveError" :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-color">
        <div class="apos-color__ui">
          <AposContextMenu
            :button="buttonOptions"
            @open="open"
            @close="close"
            menu-placement="bottom-start"
            menu-offset="5, 20"
            :disabled="field.readOnly"
            :tooltip="tooltip"
          >
            <Picker
              v-bind="pickerOptions"
              :value="next"
              @input="update"
            />
          </AposContextMenu>
        </div>
        <div class="apos-color__info">
          {{ valueLabel }}
          <AposButton
            v-if="next"
            type="quiet" label="apostrophe:clear"
            class="apos-color__clear"
            :modifiers="['no-motion']"
            @click="clear"
          />
        </div>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import Picker from '@apostrophecms/vue-color/src/components/Sketch';
import tinycolor from 'tinycolor2';

export default {
  name: 'AposInputColor',
  components: {
    Picker
  },
  mixins: [ AposInputMixin ],
  data() {
    return {
      active: false,
      tinyColorObj: null,
      startsNull: false,
      defaultFormat: 'hex8',
      defaultPickerOptions: {
        presetColors: [
          '#D0021B', '#F5A623', '#F8E71C', '#8B572A', '#7ED321',
          '#417505', '#BD10E0', '#9013FE', '#4A90E2', '#50E3C2',
          '#B8E986', '#000000', '#4A4A4A', '#9B9B9B', '#FFFFFF'
        ],
        disableAlpha: false,
        disableFields: false
      }
    };
  },
  computed: {
    buttonOptions() {
      return {
        label: this.field.label,
        type: 'color',
        color: this.value.data || ''
      };
    },
    format() {
      return this.field.options && this.field.options.format
        ? this.field.options.format
        : this.defaultFormat;
    },
    pickerOptions() {
      let fieldOptions = {};
      if (this.field.options && this.field.options.pickerOptions) {
        fieldOptions = this.field.options.pickerOptions;
      }
      return Object.assign(this.defaultPickerOptions, fieldOptions);
    },

    valueLabel() {
      if (this.next) {
        return this.next;
      } else {
        return 'None Selected';
      }
    },
    classList() {
      return [
        'apos-input-wrapper',
        'apos-color'
      ];
    }
  },
  mounted() {
    if (!this.next) {
      this.next = null;
    }
  },
  methods: {
    open() {
      this.active = true;
    },
    close() {
      this.active = false;
    },
    update(value) {
      this.tinyColorObj = tinycolor(value.hsl);
      this.next = this.tinyColorObj.toString(this.format);
    },
    validate(value) {
      if (this.field.required) {
        if (!value) {
          return 'required';
        }
      }

      if (!value) {
        return false;
      }

      const color = tinycolor(value);
      return color.isValid() ? false : 'Error';
    },
    clear() {
      this.next = null;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-color {
    display: flex;
    align-items: center;
  }

  .apos-color__clear {
    margin-left: 10px;
  }

  .apos-color__info {
    @include type-base;
    margin-left: 15px;
    color: var(--a-text-primary);
  }
</style>

<!--
  This styleblock is unscoped so that it reaches the color field's implementation
  of AposContextMenu, which is outside the component's DOM tree
-->
<style lang="scss">
  .apos-popover .vc-sketch {
    padding: 0;
    box-shadow: none;
  }
</style>
