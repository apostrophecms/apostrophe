<template>
  <div class="apos-subform">
    <AposSchema
      :class="{ 'apos-subform__disabled': busy }"
      data-apos-test="subformSchema"
      :data-apos-test-name="subform.name"
      ref="schema"
      :trigger-validation="triggerValidation"
      :schema="schema"
      :value="docFields"
      :following-values="followingValues()"
      :conditional-fields="conditionalFields()"
      :server-errors="serverErrors"
      @input="updateDocFields"
      @validate="triggerValidate"
    />
    <div class="apos-subform__controls">
      <AposButton
        data-apos-test="subformCancel"
        :disabled="busy"
        type="subtle"
        label="apostrophe:cancel"
        @click="cancel"
      />
      <AposButton
        data-apos-test="subformSubmit"
        :disabled="busy || docFields.hasErrors"
        type="primary"
        label="apostrophe:save"
        @click="submit"
      />
    </div>
  </div>
</template>
<script>
import { klona } from 'klona';
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';

export default {
  name: 'AposSubform',
  mixins: [ AposEditorMixin ],
  props: {
    errors: {
      type: Object,
      default: null
    },
    subform: {
      type: Object,
      required: true
    },
    values: {
      type: Object,
      required: true
    },
    busy: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'submit', 'cancel' ],
  data() {
    return {
      docFields: {
        data: {},
        hasErrors: false
      },
      triggerValidation: false,
      apiError: false
    };
  },

  computed: {
    schema() {
      return (this.subform.schema ?? []);
    },
    serverError() {
      return this.error || this.apiError;
    }
  },

  watch: {
    values(newValues) {
      this.docFields.data = klona(newValues);
    },
    errors(newErrors) {
      this.serverErrors = newErrors;
    }
  },
  // If we don't do for this, we get stale values.
  created() {
    this.docFields.data = klona(this.values);
  },
  methods: {
    updateDocFields(value) {
      this.docFields = value;
    },
    async submit() {
      this.triggerValidation = true;
      this.$nextTick(async () => {
        if (this.docFields.hasErrors) {
          this.triggerValidation = false;
          return;
        }
        this.$emit('submit', {
          name: this.subform.name,
          values: this.docFields.data
        });
      });
    },
    async cancel() {
      this.$emit('cancel');
    }
  }
};
</script>
<style lang="scss">
.apos-subform__controls {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-base;
  max-width: $input-max-width;
}

.apos-subform__disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>
