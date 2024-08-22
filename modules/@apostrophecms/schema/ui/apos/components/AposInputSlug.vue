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
          :id="uid"
          ref="input"
          v-model="next"
          :class="classes"
          :type="type"
          :placeholder="$t(field.placeholder)"
          :disabled="field.readOnly"
          :required="field.required"
          :tabindex="tabindex"
          :autocomplete="field.autocomplete"
          @keydown.enter="emitReturn"
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

    & {
      display: flex;
      align-items: center;
      color: var(--a-base-4);
    }

    .apos-input {
      padding-left: 0;
      border: none;

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
