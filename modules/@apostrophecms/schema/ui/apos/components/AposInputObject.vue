<template>
  <!-- Errors for the entire object field are not interesting,
    let the relevant subfield's error shine on its own -->
  <AposInputWrapper
    :field="field"
    :error="null"
    :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-input-object">
        <div class="apos-input-wrapper">
          <AposSchema
            :schema="field.schema"
            :trigger-validation="triggerValidation"
            :utility-rail="false"
            :generation="generation"
            v-model="schemaInput"
            ref="schema"
          />
        </div>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin.js';

export default {
  name: 'AposInputObject',
  mixins: [ AposInputMixin ],
  props: {
    generation: {
      type: Number,
      required: false,
      default() {
        return null;
      }
    }
  },
  data () {
    const next = this.getNext();
    return {
      schemaInput: {
        data: next
      },
      next
    };
  },
  watch: {
    schemaInput() {
      this.next = this.schemaInput.data;
    },
    generation() {
      this.next = this.getNext();
      this.schemaInput = {
        data: this.next
      };
    }
  },
  methods: {
    validate (value) {
      if (this.schemaInput.hasErrors) {
        return 'invalid';
      }
    },
    // Return next at mount or when generation changes
    getNext() {
      return this.value ? this.value.data : (this.field.def || {});
    }
  }
};
</script>

<style scoped>
  .apos-input-object {
    border-left: 1px solid var(--a-base-9);
  }
  .apos-input-wrapper {
    margin: 20px 0 0 19px;
  }
  .apos-input-object ::v-deep .apos-schema .apos-field {
    margin-bottom: 30px;
  }
</style>
