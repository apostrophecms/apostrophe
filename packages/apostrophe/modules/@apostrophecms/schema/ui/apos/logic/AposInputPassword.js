import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin.js';
import AposFieldDirectionMixin from 'Modules/@apostrophecms/schema/mixins/AposFieldDirection.js';

export default {
  name: 'AposInputPassword',
  mixins: [ AposInputMixin, AposFieldDirectionMixin ],
  emits: [ 'return' ],
  computed: {
    tabindex() {
      return this.field.disableFocus ? '-1' : '0';
    },
    classes() {
      return [ this.directionClass ].filter(Boolean);
    }
  },
  methods: {
    validate(value) {
      if (this.field.required) {
        if (!value.length) {
          return { message: 'required' };
        }
      }
      if (this.field.min) {
        if (value.length && (value.length < this.field.min)) {
          return {
            message: this.$t('apostrophe:passwordErrorMin', {
              min: this.field.min
            })
          };
        }
      }
      if (this.field.max) {
        if (value.length && (value.length > this.field.max)) {
          return {
            message: this.$t('apostrophe:passwordErrorMax', {
              max: this.field.max
            })
          };
        }
      }
      return false;
    },
    emitReturn() {
      this.$emit('return');
    }
  }
};
