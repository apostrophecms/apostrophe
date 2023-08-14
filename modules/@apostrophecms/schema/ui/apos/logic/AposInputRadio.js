import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import AposInputChoicesMixin from 'Modules/@apostrophecms/schema/mixins/AposInputChoicesMixin';
import InformationIcon from 'vue-material-design-icons/Information.vue';

export default {
  name: 'AposInputRadio',
  components: { InformationIcon },
  mixins: [ AposInputMixin, AposInputChoicesMixin ],
  methods: {
    getChoiceId(uid, value) {
      return (uid + JSON.stringify(value)).replace(/\s+/g, '');
    },
    validate(value) {
      if (this.field.required && (value === '')) {
        return 'required';
      }

      if (value && !this.choices.find(choice => choice.value === value)) {
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
