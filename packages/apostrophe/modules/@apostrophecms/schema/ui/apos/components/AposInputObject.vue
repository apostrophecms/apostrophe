<template>
  <!-- Errors for the entire object field are not interesting,
    let the relevant subfield's error shine on its own -->
  <AposInputWrapper
    :field="finalizedField"
    :modifiers="modifiers"
    :class="{ 'apos-input-object--hide-label': options.hideLabel }"
    :error="null"
    :uid="uid"
    :display-options="displayOptions"
    :meta="objectMeta"
  >
    <template #body>
      <div
        class="apos-input-object"
        :class="[{'apos-input-object--flat': options.flat}]"
      >
        <div class="apos-input-wrapper">
          <AposSchema
            ref="schema"
            v-model="schemaInput"
            :meta="currentDocMeta"
            :modifiers="modifiers"
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

<style scoped lang="scss">
  .apos-input-object--hide-label > :deep(.apos-field.apos-field--object),
  .apos-input-object--hide-label > :deep(.apos-field--micro.apos-field.apos-field--object) {
    margin-bottom: 0;
  }

  .apos-input-object:not(.apos-input-object--flat) {
    border-left: 1px solid var(--a-base-9);

    .apos-input-wrapper {
      margin: 20px 0 0 19px;
    }
  }

  .apos-input-object :deep(.apos-schema .apos-field) {
    margin-bottom: 30px;
  }
</style>
