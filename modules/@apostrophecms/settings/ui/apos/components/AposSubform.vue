<template>
  <!-- Preview mode and toggle preview/form. -->
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
import AposSubformLogic from 'Modules/@apostrophecms/settings/logic/AposSubform';

export default {
  name: 'AposSubform',
  mixins: [ AposSubformLogic ]

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
