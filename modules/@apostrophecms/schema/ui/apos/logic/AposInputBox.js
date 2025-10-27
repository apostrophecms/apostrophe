import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';

export default {
  name: 'AposInputBox',
  mixins: [ AposInputMixin ],
  emits: [ 'return' ],
  props: {
  },
  data () {
    return {
      shorthand: undefined
    };
  },
  computed: {
    isShorthand() {
      const values = Object.values(this.next);
      const allSame = values.every(v => v === values[0]);
      if (allSame) {
        return this.next.top;
      } else {
        return false;
      }
    },
    tabindex () {
      return this.field.disableFocus ? '-1' : '0';
    },
    classes() {
      return [
        'apos-input',
        'apos-input--box'
        // this.modelValue?.duplicate && 'apos-input--error'
      ];
    }
  },
  watch: {
    // next() {
    //   if (this.next && this.next.length) {
    //     this.wasPopulated = true;
    //   }
    // }
  },
  mounted() {
    // this.defineStep();
    // this.wasPopulated = this.next && this.next.length;
  },
  methods: {
    reflectShorthand(e) {
      this.next.top =
      this.next.right =
      this.next.bottom =
      this.next.left =
        this.shorthand;
    },
    update(value, prop) {
      this.next[prop] = value;
    },
    validate(value) {
      if (this.field.required) {
        if (!value && value !== 0) {
          return 'required';
        }
      }
      return false;
    },
    convert(o) {
      Object.keys(o).forEach(k => {
        o[k] = Number(o[k]);
      });
      return o;
    }
  }
};
