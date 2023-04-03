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
        this.prependEmptyChoice();
      }
    } else {
      this.choices = this.field.choices;
    }
  },

  methods: {
    prependEmptyChoice() {
      // Add an null option if there isn't one already
      if (!this.field.required && !this.choices.find(choice => {
        return choice.value === null;
      })) {
        this.choices.unshift({
          label: '',
          value: null
        });
      }
    }
  }
};
