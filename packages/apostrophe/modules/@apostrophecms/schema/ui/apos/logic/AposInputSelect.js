import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import AposInputChoicesMixin from 'Modules/@apostrophecms/schema/mixins/AposInputChoicesMixin';

export default {
  name: 'AposInputSelect',
  mixins: [ AposInputMixin, AposInputChoicesMixin ],
  props: {
    icon: {
      type: String,
      default: 'menu-down-icon'
    }
  },
  data() {
    return {
      next: (this.modelValue.data == null) ? null : this.modelValue.data,
      choices: []
    };
  },
  computed: {
    classes() {
      return [ this.modelValue?.duplicate && 'apos-input--error' ];
    }
  },
  methods: {
    validate(value) {
      if (this.field.required && (value === null)) {
        return 'required';
      }

      if (value && !this.choices.find(choice => choice.value === value)) {
        return 'invalid';
      }

      return false;
    },
    change(value) {
      // Allows expression of non-string values
      this.next = this.choices.find(choice => choice.value === value).value;
    }
  }
};
