/*
* Provides prep work for fetching choices from the server
* or defaulting to the choices provided with the field.
*/

export default {
  data() {
    return {
      choices: []
    };
  },

  async mounted() {
    if (typeof this.field.choices === 'string') {
      const action = this.options.action;
      const response = await apos.http.get(
        `${action}/choices`,
        {
          qs: {
            fieldId: this.field._id,
            docId: this.docId
          },
          busy: true
        }
      );
      if (response.choices) {
        this.choices = response.choices;
      }
    } else {
      this.choices = this.field.choices;
    }

    if (this.field.type === 'select') {
      this.prependEmptyChoice();
    }
  },

  methods: {
    prependEmptyChoice() {
      // Using `hasOwn` here, not simply checking if `field.def` is truthy
      // so that `false`, `null`, `''` or `0` are taken into account:
      const hasDefaultValue = Object.hasOwn(this.field, 'def');
      const hasNullValue = this.choices.find(choice => choice.value === null);

      // Add an null option if there isn't one already
      if (!hasDefaultValue && !hasNullValue) {
        this.choices.unshift({
          label: '',
          value: null
        });
      }
    }
  }
};
