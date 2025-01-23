import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';

export default {
  name: 'AposInputRange',
  mixins: [ AposInputMixin ],
  data() {
    return {
      next: this.initNext(),
      unit: this.field.unit || ''
    };
  },
  mounted() {
    this.$refs.range.addEventListener('input', this.updateUI);
    this.updateUI();
  },
  computed: {
    isMicro() {
      return this.modifiers.includes('micro');
    },
    minLabel() {
      return this.field.min + this.unit;
    },
    maxLabel() {
      return this.field.max + this.unit;
    },
    valueLabel() {
      return this.next + this.unit;
    },
    isSet() {
      // Detect whether or not a range is currently unset
      // Use this flag to hide/show UI elements
      if (typeof this.next === 'number' && this.next >= this.field.min) {
        return true;
      } else {
        return false;
      }
    }
  },
  methods: {
    initNext() {
      if (this.modelValue && typeof this.modelValue.data === 'number') {
        return this.modelValue.data;
      }

      return this.getDefault();
    },
    unset() {
      this.next = this.getDefault();
      this.updateUI();
    },
    getDefault() {
      return typeof this.field.def === 'number'
        ? this.field.def
        : this.field.min - 1;
    },
    updateUI() {
      const min = this.$refs.range.min;
      const max = this.$refs.range.max;
      const val = this.next < min ? min : this.next;
      this.$refs.range.style.backgroundSize = (val - min) * 100 / (max - min) + '% 100%';
    },
    validate(value) {
      if (this.field.required) {
        if (!value && value !== 0) {
          return 'required';
        }
      }
      return false;
    }
  }
};
