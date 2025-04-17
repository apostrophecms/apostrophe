<template>
  <AposInputWrapper
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :display-options="displayOptions"
    :modifiers="[...modifiers, 'full-width']"
    :items="next.items"
    :meta="areaMeta"
  >
    <template #body>
      <div
        class="apos-input-wrapper"
        :class="!next.items.length ? 'apos-is-empty' : null"
        data-apos-schema-area
      >
        <!-- We do not pass docId here because it is solely for
          contextual editing as far as the area editor is concerned. -Tom -->
        <Component
          :is="editorComponent"
          :id="next._id"
          :options="field.options"
          :items="next.items"
          :meta="areaMeta"
          :choices="choices"
          :field-id="field._id"
          :field="field"
          :following-values="followingValues"
          :generation="generation"
          @changed="changed"
        />
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputAreaLogic from '../logic/AposInputArea';
export default {
  name: 'AposInputArea',
  mixins: [ AposInputAreaLogic ]
};
</script>

<style lang="scss" scoped>
  .apos-field--area {
    max-width: $input-max-width;

    .apos-input-wrapper:not(.apos-is-empty) {
      padding: $spacing-base;
      border: 1px solid var(--a-base-8);
      border-radius: var(--a-border-radius);
    }
  }

</style>
