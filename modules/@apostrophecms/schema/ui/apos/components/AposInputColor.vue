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
            :disabled="field.disabled"
            :tooltip="tooltip"
          >
            <Picker
              v-if="next"
              v-bind="fieldOptions"
              :value="next"
              @input="update"
            />
          </AposContextMenu>
        </div>
        <div class="apos-color__info">
          {{ valueLabel }}
        </div>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import Picker from 'vue-color/src/components/Sketch';
import tinycolor from 'tinycolor2';

export default {
  name: 'AposInputColor',
  components: {
    Picker
  },
  mixins: [ AposInputMixin ],
  props: {
    // TODO need to work out field-level option overrides
    fieldOptions: {
      type: Object,
      default() {
        return {
          presetColors: [
            '#D0021B', '#F5A623', '#F8E71C', '#8B572A', '#7ED321',
            '#417505', '#BD10E0', '#9013FE', '#4A90E2', '#50E3C2',
            '#B8E986', '#000000', '#4A4A4A', '#9B9B9B', '#FFFFFF'
          ],
          disableAlpha: false,
          disableFields: false,
          format: 'hex8'
        };
      }
    }
  },
  data() {
    return {
      active: false,
      tinyColorObj: null,
      startsNull: false,
      tooltip: this.field.disabled ? 'Field is disabled' : false
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
      // vue-color does not support null values
      // If a color begins null, set it to a transparent black and flag it
      this.next = '#00000000';
      this.startsNull = true;
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
      this.next = this.tinyColorObj.toString(this.fieldOptions.format);

      if (this.startsNull) {
        // As a basic UX courtesey make sure to reset the alpha value of an orginally null value back to 1
        // as it was previously set to 0 by us, not the user.
        this.next = this.tinyColorObj.setAlpha(1).toString(this.fieldOptions.format);
        this.startsNull = false;
      }
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
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-color {
    display: flex;
    align-items: center;
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
