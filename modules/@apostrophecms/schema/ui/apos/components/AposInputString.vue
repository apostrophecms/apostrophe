<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="effectiveError" :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <textarea
          :class="classes"
          v-if="field.textarea && field.type === 'string'" rows="5"
          v-model="next" :placeholder="$t(field.placeholder)"
          @keydown.enter="enterEmit"
          :disabled="field.readOnly"
          :required="field.required"
          :id="uid" :tabindex="tabindex"
        />
        <input
          v-else :class="classes"
          v-model="next" :type="type"
          :placeholder="$t(field.placeholder)"
          @keydown.enter="enterEmit"
          :disabled="field.readOnly || field.disabled"
          :required="field.required"
          :id="uid" :tabindex="tabindex"
          :step="step"
        >
        <component
          v-if="icon"
          :size="iconSize"
          class="apos-input-icon"
          :is="icon"
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
    // height of date/time input is slightly larger than others due to the browser spinner ui
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
