<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="effectiveError" :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div :class="wrapperClasses">
        <span
          class="apos-input__slug-locale-prefix"
          v-if="localePrefix"
          @click="passFocus"
          v-apos-tooltip="'apostrophe:cannotChangeSlugPrefix'"
        >
          {{ localePrefix }}
        </span>
        <input
          :class="classes"
          v-model="next" :type="type"
          :placeholder="$t(field.placeholder)"
          @keydown.enter="$emit('return')"
          :disabled="field.readOnly" :required="field.required"
          :id="uid" :tabindex="tabindex"
          ref="input"
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
