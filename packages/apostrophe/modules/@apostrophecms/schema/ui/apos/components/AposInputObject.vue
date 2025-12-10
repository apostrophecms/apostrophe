<template>
  <!-- Errors for the entire object field are not interesting,
    let the relevant subfield's error shine on its own -->
  <AposInputWrapper
    :field="field"
    :error="null"
    :uid="uid"
    :display-options="displayOptions"
    :meta="objectMeta"
  >
    <template #body>
      <div class="apos-input-object">
        <div class="apos-input-wrapper">
          <AposSchema
            ref="schema"
            v-model="schemaInput"
            :meta="currentDocMeta"
            :schema="schema"
            :trigger-validation="triggerValidation"
            :generation="generation"
            :doc-id="docId"
            :conditional-fields="conditionalFields"
            :following-values="followingValuesWithParent"
            :server-errors="currentDocServerErrors"
            @update:model-value="evaluateConditions(values)"
            @validate="emitValidate()"
          />
        </div>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputObjectLogic from '../logic/AposInputObject';
export default {
  name: 'AposInputObject',
  mixins: [ AposInputObjectLogic ]
};
</script>

<style scoped>
  .apos-input-object {
    border-left: 1px solid var(--a-base-9);
  }

  .apos-input-wrapper {
    margin: 20px 0 0 19px;
  }

  .apos-input-object :deep(.apos-schema .apos-field) {
    margin-bottom: 30px;
  }
</style>
