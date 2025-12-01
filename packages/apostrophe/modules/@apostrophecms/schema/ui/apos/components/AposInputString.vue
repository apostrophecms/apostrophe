<template>
  <AposInputWrapper
    :modifiers="modifiers"
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :display-options="displayOptions"
    :meta="fieldMeta"
    @replace-field-value="replaceFieldValue"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <textarea
          v-if="field.textarea && field.type === 'string'"
          :id="uid"
          v-model="next"
          :rows="rows"
          :class="classes"
          :placeholder="$t(field.placeholder)"
          :disabled="field.readOnly"
          :required="field.required"
          :tabindex="tabindex"
          :autocomplete="field.autocomplete"
          @keydown.enter="enterEmit"
        />
        <input
          v-else
          :id="uid"
          v-model="next"
          :class="classes"
          :type="type"
          :placeholder="$t(field.placeholder)"
          :disabled="field.readOnly || field.disabled"
          :required="field.required"
          :tabindex="tabindex"
          :step="step"
          :autocomplete="field.autocomplete"
          @keydown.enter="enterEmit"
        >
        <component
          :is="icon"
          v-if="icon"
          :size="iconSize"
          class="apos-input-icon"
        />
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputStringLogic from '../logic/AposInputString';
export default {
  name: 'AposInputString',
  mixins: [ AposInputStringLogic ]
};
</script>

<style lang="scss" scoped>
  .apos-input--date,
  .apos-input--time {
    // lame magic number ..
    // height of date/time input is slightly larger than others due to
    // the browser spinner ui
    height: 46px;
    padding-right: 40px;
  }

  .apos-input--date {
    &::-webkit-clear-button {
      position: relative;
      right: 5px;
    }
  }

  .apos-field--small .apos-input--date,
  .apos-field--small .apos-input--time {
    height: 33px;
  }
</style>
