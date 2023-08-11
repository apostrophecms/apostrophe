<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="effectiveError" :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <input
          type="password"
          class="apos-input apos-input--password"
          v-model="next"
          :placeholder="$t(field.placeholder)"
          :disabled="field.readOnly"
          :required="field.required"
          :id="uid"
          :tabindex="tabindex"
          @keydown.enter="$emit('return')"
        >
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputPasswordLogic from '../logic/AposInputPassword';
export default {
  name: 'AposInputPassword',
  mixins: [ AposInputPasswordLogic ]
};
</script>
