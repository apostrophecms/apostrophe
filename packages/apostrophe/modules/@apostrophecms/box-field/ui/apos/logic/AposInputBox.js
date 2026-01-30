import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';

export default {
  name: 'AposInputBox',
  mixins: [ AposInputMixin ],
  emits: [ 'return' ],
  props: {
  },
  data () {
    return {
      next: this.getNext(),
      shorthand: undefined,
      mode: undefined,
      individualFocus: undefined,
      defValue: {
        top: null,
        right: null,
        bottom: null,
        left: null
      }
    };
  },
  computed: {
    isEmpty() {
      if (!this.next) {
        return true;
      }
      const values = Object.values(this.next);
      const unique = [ ...new Set(values) ];
      return unique.length === 1 && unique[0] === null;
    },
    isDef() {
      return this.isEqual(this.field.def, this.next);
    },
    hasCustomDef() {
      return !this.isEqual(this.field.def, this.defValue);
    },
    tabindex () {
      return this.field.disableFocus ? '-1' : '0';
    },
    classes() {
      return [
        'apos-input',
        'apos-input--box'
      ];
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.shorthand = this.getShorthand();
      this.mode = this.getMode();
      this.adjustAllWidths();
    });
  },
  methods: {
    getShorthand() {
      const values = Object.values(this.next);

      if (values.every(v => v === values[0])) {
        return values[0];
      } else {
        return null;
      }
    },
    getMode() {
      if (this.shorthand || this.shorthand === 0) {
        return 'shorthand';
      }

      const unique = [ ...new Set(Object.values(this.next)) ];

      if (unique.length === 1 && unique[0] === null) {
        return 'shorthand';
      }

      return 'individual';
    },
    reflectShorthand() {
      let val = this.shorthand;

      if (!val) {
        val = null;
      }
      this.next.top =
      this.next.right =
      this.next.bottom =
      this.next.left =
        val;
    },
    update(value, prop) {
      this.next[prop] = value;
    },
    validate(value) {

      // One non-null value if required
      if (this.field.required) {
        const unique = [ ...new Set(Object.values(value)) ];
        if (unique.length === 1 && unique[0] === null) {
          return 'required';
        }
      }

      // All values are numbers
      for (const key of Object.keys(this.defValue)) {
        if (value[key] && !Number.isFinite(value[key])) {
          return this.$t('apostrophe:boxFieldErrorNumbers');
        }
      }

      // Minimum values in range
      if (this.field.min) {
        for (const key of Object.keys(this.defValue)) {
          if (value[key] && value[key] < this.field.min) {
            return this.$t('apostrophe:boxFieldErrorMin', { min: this.field.min });
          }
        }
      }

      // Maximum values in range
      if (this.field.max) {
        for (const key of Object.keys(this.defValue)) {
          if (value[key] && value[key] > this.field.max) {
            return this.$t('apostrophe:boxFieldErrorMax', { max: this.field.max });
          }
        }
      }

      return false;
    },
    convert(o) {
      Object.keys(o).forEach(k => {
        if (o[k]) {
          o[k] = Number(o[k]);
        }
      });
      return o;
    },
    getNext() {
      return this.modelValue?.data
        ? this.modelValue.data
        : this.field.def;
    },
    adjustWidth(side) {
      if (this.modifiers.includes('micro')) {
        return;
      }
      if (this.$refs[`input-side-${side}`]) {
        const length = this.$refs[`input-side-${side}`][0].value.length;
        this.$refs[`input-side-${side}`][0].style.width = `${length * 20}px`;
      }
    },
    adjustAllWidths() {
      Object.keys(this.defValue).forEach(side => this.adjustWidth(side));
    },
    clearOrReset() {
      if (this.hasCustomDef) {
        this.reset();
      } else {
        this.clear();
      }
      this.$nextTick(() => {
        this.shorthand = this.getShorthand();
        this.mode = this.getMode();
        this.adjustAllWidths();
      });
    },
    reset() {
      this.next = { ...this.field.def };
    },
    clear() {
      this.next = { ...this.defValue };
    },
    isEqual(a, b) {
      if (a === b) {
        return true;
      }
      if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) {
        return false;
      }

      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) {
        return false;
      }

      for (const key of keysA) {
        if (!keysB.includes(key)) {
          return false;
        }
        if (!this.isEqual(a[key], b[key])) {
          return false;
        }
      }

      return true;
    }
  }
};
