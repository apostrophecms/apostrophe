/*
* Provides prep work for fetching choices from the server
* or defaulting to the choices provided with the field.
*/

import { debounceAsync } from 'Modules/@apostrophecms/ui/utils';

const DEBOUNCE_TIMEOUT = 500;

export default {
  data() {
    return {
      choices: [],
      fieldReady: false
    };
  },

  async mounted() {
    this.debouncedUpdateChoices = debounceAsync(this.getChoices, DEBOUNCE_TIMEOUT, {
      onSuccess: this.updateChoices
    });
    await this.debouncedUpdateChoices.skipDelay();
    this.fieldReady = true;
  },

  watch: {
    followingValues: {
      deep: true,
      handler() {
        // Avoid race condition
        return this.debouncedUpdateChoices && this.debouncedUpdateChoices();
      }
    }
  },

  methods: {
    async getChoices() {
      this.fieldReady = false;
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
              following: {
                ...this.followingValues
              }
            }
          }
        );
        if (response.choices) {
          return response.choices;
        }
      } else {
        return this.field.choices;
      }
    },
    updateChoices(choices) {
      this.choices = choices;
      this.fieldReady = true;
      if (this.field.type === 'select') {
        this.prependEmptyChoice();
      }
      this.validate(this.next);
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
