<template>
  <AposInputWrapper
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :modifiers="modifiers"
    :display-options="displayOptions"
  >
    <template #body>
      <AposSelect
        :icon="icon"
        :choices="choices"
        :classes="classes"
        :disabled="field.readOnly"
        :selected="modelValue.data"
        :autocomplete="field.autocomplete"
        @change="change"
      />
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputSelectLogic from '../logic/AposInputSelect';
export default {
  name: 'AposInputSelect',
  mixins: [ AposInputSelectLogic ]
};
</script>
