
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import AposInputChoicesMixin from 'Modules/@apostrophecms/schema/mixins/AposInputChoicesMixin';

export default {
  name: 'AposInputCheckboxes',
  mixins: [ AposInputMixin, AposInputChoicesMixin ],
  beforeMount () {
    this.modelValue.data = Array.isArray(this.modelValue.data) ? this.modelValue.data : [];
  },
  methods: {
    getChoiceId(uid, value) {
      return uid + value.replace(/\s/g, '');
    },
    watchValue () {
      this.error = this.modelValue.error;
      this.next = this.modelValue.data || [];
    },
    validate(values) {
      // The choices and values should always be arrays.
      if (!Array.isArray(this.choices) || !Array.isArray(values)) {
        return 'malformed';
      }

      if (this.field.required && !values.length) {
        return 'required';
      }

      if (this.field.min) {
        if ((values != null) && (values.length < this.field.min)) {
          return this.$t('apostrophe:minUi', { number: this.field.min });
        }
      }
      if (this.field.max) {
        if ((values != null) && (values.length > this.field.max)) {
          return this.$t('apostrophe:maxUi', { number: this.field.max });
        }
      }

      if (Array.isArray(values)) {
        values.forEach(chosen => {
          if (!this.choices.map(choice => {
            return choice.value;
          }).includes(chosen)) {
            return 'invalid';
          }
        });
      }

      return false;
    },
    selectItems(choice) {
      if (choice.value === '__all') {
        this.modelValue.data = this.choices.length === this.modelValue.data.length
          ? []
          : this.choices.map(({ value }) => value);

        return;
      }

      if (this.modelValue.data.includes(choice.value)) {
        this.modelValue.data = this.modelValue.data.filter((val) => val !== choice.value);
      } else {
        this.modelValue.data.push(choice.value);
      }
    }
  }
};
