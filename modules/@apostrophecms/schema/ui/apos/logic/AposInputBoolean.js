
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';

export default {
  name: 'AposInputBoolean',
  mixins: [ AposInputMixin ],
  computed: {
    classList: function () {
      return [
        'apos-input-wrapper',
        'apos-boolean',
        {
          'apos-boolean--toggle': this.field.toggle
        }
      ];
    },
    trueLabel: function () {
      if (this.field.toggle && this.field.toggle.true &&
        typeof this.field.toggle.true === 'string') {
        return this.field.toggle.true;
      } else {
        return false;
      }
    },
    falseLabel: function () {
      if (this.field.toggle && this.field.toggle &&
        typeof this.field.toggle.false === 'string') {
        return this.field.toggle.false;
      } else {
        return false;
      }
    }
  },
  methods: {
    setValue(val) {
      this.next = val;
      this.$refs[(!val).toString()].checked = false;
    },
    validate(value) {
      if (this.field.required) {
        if (!value && value !== false) {
          return 'required';
        }
      }
      return false;
    }
  }
};
