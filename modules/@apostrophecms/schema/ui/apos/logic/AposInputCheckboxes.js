import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import AposInputChoicesMixin from 'Modules/@apostrophecms/schema/mixins/AposInputChoicesMixin';

export default {
  name: 'AposInputCheckboxes',
  mixins: [ AposInputMixin, AposInputChoicesMixin ],
  beforeMount () {
    this.modelValue.data = Array.isArray(this.modelValue.data)
      ? this.modelValue.data
      : [];
  },
  watch: {
    'modelValue.data'(oldValue, newValue) {
      console.log({
        oldValue,
        newValue
      });
    }
  },
  methods: {
    getChoiceId(uid, value) {
      return (uid + JSON.stringify(value)).replace(/\s+/g, '');
    },
    watchValue () {
      console.log({
        next: this.next,
        modelValueData: this.modelValue.data
      });
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
      console.log({
        choice: choice.value,
        data: this.modelValue.data
      });
    },
    change(choice) {
      console.log({
        choice,
        value: choice.value,
        data: this.modelValue.data
      });

      this.modelValue.data = this.modelValue.data.includes(choice.value)
        ? this.modelValue.data.filter(value => value !== choice.value)
        : this.modelValue.data.concat(event.value);

      console.log({
        choice,
        data: this.modelValue.data
      });
    }
  },
  computed: {
    checkProxy: {
      get() {
        console.log('get', { data: this.modelValue.data });
        return this.modelValue.data;
      },
      set(val) {
        console.log('set', { val });
        this.$emit('update:modelValue', val);
      }
    }
  }
};
