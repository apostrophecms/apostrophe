
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import AposColor from '../components/AposColor.vue';
import { TinyColor } from '@ctrl/tinycolor';

export default {
  name: 'AposInputColor',
  components: {
    AposColor
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
    // Color picker doesn't allow null or undefined values
    pickerValue() {
      return this.next || '';
    },
    buttonOptions() {
      return {
        label: this.field.label,
        type: 'color',
        color: this.modelValue.data || ''
      };
    },
    format() {
      return this.field.options && this.field.options.format
        ? this.field.options.format
        : this.defaultFormat;
    },
    pickerOptions() {
      const fieldOptions = this.field.options?.pickerOptions || {};
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
      this.tinyColorObj = new TinyColor(value.hsl);
      if (value._cssVariable) {
        this.next = value._cssVariable;
      } else {
        this.next = this.tinyColorObj.toString(this.format);
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
