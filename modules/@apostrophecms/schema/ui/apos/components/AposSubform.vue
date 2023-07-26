<template>
  <div class="apos-subform">
    <!-- Preview mode -->
    <div v-if="preview" class="apos-subform__preview">
      <div class="apos-subform__preview-grid">
        <AposSubformPreview
          v-if="preview"
          :subform="subform"
          :values="values"
        />
        <span
          v-if="updateIndicator"
          class="apos-subform__preview-update-indicator"
        >{{ $t('apostrophe:updated') }}</span>
        <AposIndicator
          v-else
          class="apos-subform__preview-icon"
          icon="chevron-down-icon"
        />
      </div>
      <button
        class="apos-subform__preview-trigger"
        @click="togglePreview"
      />
    </div>
    <!-- Schema -->
    <div v-else class="apos-subform__schema">
      <span v-if="subform.label" class="apos-subform__schema-label">
        {{ $t(subform.label) }}
      </span>
      <AposSchema
        :class="{ 'apos-subform__disabled': busy }"
        data-apos-test="subformSchema"
        :data-apos-test-name="subform.name"
        ref="schema"
        :trigger-validation="triggerValidation"
        :schema="schema"
        :value="docFields"
        :following-values="followingValues()"
        :conditional-fields="conditionalFields()"
        :server-errors="serverErrors"
        @input="updateDocFields"
        @validate="triggerValidate"
      />
      <div class="apos-subform__controls">
        <AposButton
          data-apos-test="subformCancel"
          :disabled="busy"
          type="subtle"
          label="apostrophe:cancel"
          @click="cancel"
        />
        <AposButton
          data-apos-test="subformSubmit"
          :disabled="busy || docFields.hasErrors"
          type="primary"
          label="apostrophe:save"
          @click="submit"
        />
      </div>
    </div>
  </div>
</template>
<script>
import AposSubformLogic from 'Modules/@apostrophecms/schema/logic/AposSubform';

export default {
  name: 'AposSubform',
  mixins: [ AposSubformLogic ]

};
</script>
<style lang="scss" scoped>
.apos-subform {
  position: relative;

  &__preview-trigger {
    z-index: $z-index-default;
    position: absolute;
    box-sizing: border-box;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    display: block;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: none;
    opacity: 0;
    cursor: pointer;
  }

  &__preview-grid {
    display: grid;
    grid-template-columns: 1fr 120px;
    align-items: center;
    // align with the modal header language indicator,
    // which is too deep and can't be re-styled
    // margin-right: $spacing-double;
  }

  &__schema {
    padding-top: $spacing-double;
    // align with the modal header language indicator,
    // which is too deep and can't be re-styled
    // margin-right: $spacing-double;
  }

  &__schema-label {
    @include type-base;

    display: block;
    color: var(--a-base-3);
    line-height: 1;
    padding-bottom: $spacing-double;
  }

  &__controls {
    display: flex;
    justify-content: flex-end;
    gap: $spacing-base;
    max-width: $input-max-width;
  }

  &__preview-icon,
  &__preview-update-indicator {
    justify-self: end;
  }

  &__preview-update-indicator {
    color: var(--a-success);
  }

  &__disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}
</style>
