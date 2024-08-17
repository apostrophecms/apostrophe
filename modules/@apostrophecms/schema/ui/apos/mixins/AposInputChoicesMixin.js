/*
* Provides prep work for fetching choices from the server
* or defaulting to the choices provided with the field.
*/

import { debounce } from 'Modules/@apostrophecms/ui/ui/apos/utils/index';

export default {
  data() {
    return {
      choices: []
    };
  },

  async mounted() {
    this.debouncedUpdateChoices = debounce(this.updateChoices, 250);
    return updateChoices();
  },

  watch: {
    followingValues: {
      deep: true,
      handler() {
        return this.debouncedUpdateChoices();
      }
    }
  },

  methods: {
    async updateChoices() {
      if (typeof this.field.choices === 'string') {
        const action = this.options.action;
        const response = await apos.http.post(
          `${action}/choices`,
          {
            qs: {
              fieldId: this.field._id,
              docId: this.docId
            },
            busy: true,
            body: {
              ...this.followingValues
            }
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
