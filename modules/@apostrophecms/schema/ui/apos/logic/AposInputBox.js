import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';

export default {
  name: 'AposInputBox',
  mixins: [ AposInputMixin ],
  emits: [ 'return' ],
  props: {
    // rows: {
    //   type: Number,
    //   default: 5
    // }
  },
  data () {
    return {
      shorthand: undefined,
      top: undefined,
      right: undefined,
      bottom: undefined,
      left: undefined
      // step: undefined,
      // wasPopulated: false
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
    // icon () {
    //   if (this.error) {
    //     return 'circle-medium-icon';
    //   } else if (this.field.icon) {
    //     return this.field.icon;
    //   } else {
    //     return null;
    //   }
    // }
  },
  watch: {
    // followingValues: {
    //   // We may be following multiple fields, like firstName and lastName,
    //   // or none at all, depending
    //   deep: true,
    //   handler(newValue, oldValue) {
    //     if (this.field.followingIgnore === true) {
    //       return;
    //     }
    //     let ov = oldValue;
    //     let nv = newValue;
    //     if (Array.isArray(this.field.followingIgnore)) {
    //       ov = Object.fromEntries(
    //         Object.entries(oldValue).filter(([ key ]) => {
    //           return !this.field.followingIgnore.includes(key);
    //         })
    //       );
    //       nv = Object.fromEntries(
    //         Object.entries(newValue).filter(([ key ]) => {
    //           return !this.field.followingIgnore.includes(key);
    //         })
    //       );
    //     }
    //     // Follow the value of the other field(s), but only if our
    //     // previous value matched the previous value of the other field(s)
    //     oldValue = Object.values(ov).join(' ').trim();
    //     newValue = Object.values(nv).join(' ').trim();

    //     if (
    //       (!this.wasPopulated &&
    //       ((this.next == null) || (!this.next.length))) || (this.next === oldValue)
    //     ) {
    //       this.next = newValue;
    //     }
    //   }
    // },
    // next() {
    //   if (this.next && this.next.length) {
    //     this.wasPopulated = true;
    //   }
    // }
  },
  mounted() {
    // this.top = this.next.top;
    // this.right = this.next.right;
    // this.bottom = this.next.bottom;
    // this.left = this.next.left;
    // this.defineStep();
    // this.wasPopulated = this.next && this.next.length;
  },
  methods: {
    reflectShorthand() {
      this.top =
      this.right =
      this.bottom =
      this.left =
      this.next.top =
      this.next.right =
      this.next.bottom =
      this.next.left =
        this.shorthand;
    },
    update(value, prop) {
      this.next[prop] = value;
    },
    // enterEmit() {
    //   if (this.field.enterSubmittable) {
    //     // Include the validated results in cases where an Enter keydown should
    //     // act as submitting a form.
    //     this.$emit('return', {
    //       data: this.next,
    //       error: this.validate(this.next)
    //     });
    //   } else {
    //     this.$emit('return');
    //   }
    // },
    validate(value) {
      if (this.field.required) {
        if (!value && value !== 0) {
          return 'required';
        }
      }
      return false;
    },
    convert(s) {
      // if (this.field.type === 'integer') {
      //   if ((s == null) || (s === '')) {
      //     return s;
      //   } else {
      //     return parseInt(s);
      //   }
      // } else if (this.field.type === 'float') {
      //   if ((s == null) || (s === '')) {
      //     return s;
      //   } else {
      //     // The native parse float converts 3.0 to 3 and makes
      //     // next to become integer. In theory we don't need parseFloat
      //     // as the value is natively guarded by the browser 'number' type.
      //     // However we need a float value sent to the backend
      //     // and we force that when focus is lost.
      //     if (this.focus && `${s}`.match(/\.[0]*$/)) {
      //       return s;
      //     }
      //     return parseFloat(s);
      //   }
      // } else {
      //   if (s == null) {
      //     return '';
      //   } else {
      //     return s.toString();
      //   }
      // }
    }
  }
};
