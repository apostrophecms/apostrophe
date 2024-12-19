import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';

export default {
  name: 'AposInputRange',
  mixins: [ AposInputMixin ],
  data() {
    return {
      unit: this.field.unit || ''
    };
  },
  computed: {
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
      if (this.next >= this.field.min) {
        return true;
      } else {
        return false;
      }
    }
  },
  mounted() {
    // The range spec defaults to a value of midway between the min and max
    // Example: a range with an unset value and a min of 0 and max of 100 will become 50
    // This does not allow ranges to go unset :(
    if (!this.next && this.next !== 0) {
      this.unset();
    }
  },
  methods: {
    // Default to a value outside the range when no def is defined,
    // to be used as a flag.
    // The value will be set to null later in validation
    unset() {
      this.next = typeof this.field.def === 'number'
        ? this.field.def
        : this.field.min - 1;
    },
    validate(value) {
      if (this.field.required) {
        if (!value && value !== 0) {
          return 'required';
        }
      }
      return false;
    },
    convert(value) {
      return parseFloat(value);
    }
  }
};
