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

    if (this.field.type !== 'select') {
      return;
    }

    this.prependEmptyChoice();
    this.$nextTick(() => {
      // this has to happen on nextTick to avoid emitting before schemaReady is
      // set in AposSchema
      if (this.field.required && this.next == null && this.choices[0] != null) {
        this.next = this.choices[0].value;
      }
    });
  },

  methods: {
    prependEmptyChoice() {
      const hasNullValue = this.choices.find(choice => choice.value === null);

      // Add an null option if there isn't one already
      if (!this.field.required && !hasNullValue) {
        this.choices.unshift({
          label: '',
          value: null
        });
      }
    }
  }
};
