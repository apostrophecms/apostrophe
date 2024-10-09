/*
* Provides prep work for fetching choices from the server
* or defaulting to the choices provided with the field.
*/

import { debounceAsync } from 'Modules/@apostrophecms/ui/utils';

const DEBOUNCE_TIMEOUT = 500;

export default {
  data() {
    return {
      choices: []
    };
  },

  async mounted() {
    console.log('getting debounced fn for ' + this.field.name);
    this.debouncedUpdateChoices = debounceAsync(this.getChoices, DEBOUNCE_TIMEOUT, {
      onSuccess: this.updateChoices
    });
    console.log('calling debounced fn for ' + this.field.name);
    await this.debouncedUpdateChoices.skipDelay();
    console.log('after initial call for ' + this.field.name);
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
    async getChoices() {
      console.log('entering debounced fn for ' + this.field.name);
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
          console.log('returning:', response.choices);
          return response.choices;
        }
      } else {
        console.log('returning:', this.field.choices);
        return this.field.choices;
      }
    },
    updateChoices(choices) {
      console.log('setting');
      this.choices = choices;
      console.log('after set');
      if (this.field.type === 'select') {
        console.log('prepending');
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
