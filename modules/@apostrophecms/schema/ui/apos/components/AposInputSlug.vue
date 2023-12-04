<template>
  <AposInputWrapper
    :modifiers="modifiers"
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div :class="wrapperClasses">
        <span
          v-if="localePrefix"
          v-apos-tooltip="'apostrophe:cannotChangeSlugPrefix'"
          class="apos-input__slug-locale-prefix"
          @click="passFocus"
        >
          {{ localePrefix }}
        </span>
        <input
          v-model="next"
          :id="uid"
          :class="classes"
          :type="type"
          :placeholder="$t(field.placeholder)"
          ref="input"
          :disabled="field.readOnly"
          :required="field.required"
          :tabindex="tabindex"
          @keydown.enter="$emit('return')"
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
import AposInputSlugLogic from '../logic/AposInputSlug';
export default {
  name: 'AposInputSlug',
  mixins: [ AposInputSlugLogic ]
};
</script>

<style lang="scss" scoped>
  .apos-input-wrapper--with-prefix {
    @include apos-input();
    display: flex;
    align-items: center;
    color: var(--a-base-4);
    .apos-input {
      border: none;
      padding-left: 0;
      &:hover,
      &:focus {
        border: none;
        box-shadow: none;
      }
    }
  }
  .apos-input__slug-locale-prefix {
    display: inline-block;
    padding-left: 20px;
  }
  .apos-field--inverted .apos-input-wrapper--with-prefix {
    background-color: var(--a-background-primary);
  }
</style>
