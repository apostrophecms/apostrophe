
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import AposColor from '../components/AposColor.vue';
import { TinyColor } from '@ctrl/tinycolor';
import { finalOptions } from './finalOptions.js';

const defaultOptions = { ...apos.modules['@apostrophecms/color-field'].defaultOptions };

export default {
  name: 'AposInputColor',
  components: {
    AposColor
  },
  mixins: [ AposInputMixin ],
  data() {
    return {
      active: false,
      tinyColorObj: null
    };
  },
  computed: {
    tooltip() {
      let tooltip = this.$t('apostrophe:colorFieldClickToSelect');
      if (this.next) {
        tooltip = `${this.$t('apostrophe:colorFieldColorValue', { color: this.next })} ${tooltip}`;
      }
      return tooltip;
    },
    isMicro() {
      return this.modifiers.includes('micro');
    },
    isInline() {
      return this.modifiers.includes('inline');
    },
    pickerValue() {
      return this.next || this.defaultValue;
    },
    // Color picker doesn't allow null or undefined values
    defaultValue() {
      return this.field.def || '';
    },
    buttonOptions() {
      return {
        label: this.field.label,
        type: this.isMicro ? 'color-micro' : 'color',
        color: this.modelValue.data || ''
      };
    },
    options() {
      return this.field?.options || {};
    },
    classList() {
      return [
        'apos-input-wrapper',
        'apos-color'
      ];
    },
    finalOptions() {
      return finalOptions(defaultOptions, this.options);
    }
  },
  mounted() {
    if (!this.next) {
      this.next = '';
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
      this.next = value;
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

      const color = new TinyColor(value);
      if (!value.startsWith('--')) {
        return color.isValid ? false : 'Error';
      }
    },
    clear() {
      this.next = '';
    }
  }
};
