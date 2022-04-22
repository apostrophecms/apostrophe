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
            v-model="schemaInput"
            ref="schema"
          />
        </div>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import { klona } from 'klona';

export default {
  name: 'AposInputObject',
  mixins: [ AposInputMixin ],
  data () {
    const next = this.value ? this.value.data : (this.field.def || {});
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
    }
  },
  methods: {
    validate (value) {
      if (this.schemaInput.hasErrors) {
        return 'invalid';
      }
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