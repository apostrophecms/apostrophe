<template>
  <AposInputWrapper
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :modifiers="modifiers"
    :display-options="displayOptions"
  >
    <template #body>
      <AposCombo
        v-if="field.style === 'combo' && choices.length"
        :choices="choices"
        :field="field"
        :model-value="modelValue"
        @select-items="selectItems"
      />

      <AposCheckbox
        v-for="choice in choices"
        v-else
        :id="getChoiceId(uid, choice.value)"
        :key="choice.value"
        v-model="next"
        :for="getChoiceId(uid, choice.value)"
        :choice="choice"
        :field="field"
      />
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputCheckboxesLogic from '../logic/AposInputCheckboxes';
export default {
  name: 'AposInputCheckboxes',
  mixins: [ AposInputCheckboxesLogic ]
};
</script>
