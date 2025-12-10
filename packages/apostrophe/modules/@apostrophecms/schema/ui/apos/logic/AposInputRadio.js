import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import AposInputChoicesMixin from 'Modules/@apostrophecms/schema/mixins/AposInputChoicesMixin';
import InformationIcon from '@apostrophecms/vue-material-design-icons/Information.vue';

export default {
  name: 'AposInputRadio',
  components: { InformationIcon },
  mixins: [ AposInputMixin, AposInputChoicesMixin ],
  methods: {
    getChoiceId(uid, value) {
      return (uid + JSON.stringify(value)).replace(/\s+/g, '');
    },
    validate(value) {
      const validValue = this.choices.some((choice) => choice.value === value);
      if (this.field.required && !validValue && !value) {
        return 'required';
      }

      if (value && !validValue) {
        return 'invalid';
      }

      return false;
    },
    change(value) {
      // Allows expression of non-string values
      this.next = this.choices.find(choice => choice.value === JSON.parse(value)).value;
    }
  }
};
