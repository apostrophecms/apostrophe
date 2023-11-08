<template>
  <AposInputWrapper
    :field="field" :error="effectiveError"
    :uid="uid"
    :modifiers="modifiers"
    :display-options="displayOptions"
  >
    <template #body>
      <AposCombo
        v-if="field.style === 'combo' && choices.length"
        :choices="choices"
        :field="field"
        :value="value"
        @select-items="selectItems"
      />

      <AposCheckbox
        v-else
        :for="getChoiceId(uid, choice.value)"
        v-for="choice in choices"
        :key="choice.value"
        :id="getChoiceId(uid, choice.value)"
        :choice="choice"
        :field="field"
        v-model="value.data"
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
