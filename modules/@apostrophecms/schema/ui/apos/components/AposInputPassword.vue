<template>
  <AposInputWrapper
    :modifiers="modifiers"
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <input
          :id="uid"
          v-model="next"
          type="password"
          class="apos-input apos-input--password"
          :placeholder="$t(field.placeholder)"
          :disabled="field.readOnly"
          :required="field.required"
          :tabindex="tabindex"
          :autocomplete="field.autocomplete"
          @keydown.enter="emitReturn"
        >
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputPasswordLogic from '../logic/AposInputPassword';
export default {
  name: 'AposInputPassword',
  mixins: [ AposInputPasswordLogic ],
  emits: [ 'return' ]
};
</script>
