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
        v-model="checkProxy"
        :for="getChoiceId(uid, choice.value)"
        :choice="choice"
        :field="{
          ...field,
          name: choice.value
        }"
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
