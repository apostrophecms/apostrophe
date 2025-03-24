<template>
  <div
    class="apos-subform"
    :class="{ 'apos-separator': separator }"
  >
    <!-- Schema -->
    <transition name="slide-fade">
      <div
        v-if="expanded"
        class="apos-subform__schema"
      >
        <span
          v-if="subform.label"
          class="apos-subform__schema-label"
        >
          {{ $t(subform.label) }}
        </span>
        <AposSchema
          ref="schema"
          data-apos-test="subformSchema"
          :class="{ 'apos-subform__disabled': busy }"
          :data-apos-test-name="subform.name"
          :trigger-validation="triggerValidation"
          :schema="schema"
          :model-value="docFields"
          :following-values="followingValues()"
          :conditional-fields="conditionalFields"
          :server-errors="serverErrors"
          :modifiers="['small']"
          @update:model-value="updateDocFields"
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
    </transition>
    <!-- Preview mode -->
    <div
      v-if="!expanded"
      class="apos-subform__preview"
    >
      <div class="apos-subform__preview-grid">
        <AposSubformPreview
          :subform="subform"
          :values="values"
        />
        <span
          v-if="updateIndicator && !triggerHover"
          class="apos-subform__preview-update-indicator"
        >{{ $t('apostrophe:updated') }}</span>
        <span
          v-else-if="triggerHover"
          class="apos-subform__preview-edit-indicator"
        >{{ $t('apostrophe:edit') }}</span>
        <AposIndicator
          v-else
          class="apos-subform__preview-icon"
          icon="chevron-down-icon"
        />
      </div>
      <button
        class="apos-subform__preview-trigger"
        @click="toggleExpanded"
        @mouseenter="triggerHover = true"
        @mouseleave="triggerHover = false"
      />
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
  max-width: $input-max-width;

  &__preview-trigger {
    z-index: $z-index-default;
    position: absolute;
    inset: 0;
    display: block;
    box-sizing: border-box;
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
    grid-template-columns: 1fr 80px;
    align-items: center;
  }

  &__schema {
    padding: $spacing-double 0;
  }

  &__schema-label {
    @include type-base;

    & {
      display: block;
      padding-bottom: $spacing-double;
      color: var(--a-base-3);
      line-height: 1;
    }
  }

  &__controls {
    display: flex;
    justify-content: flex-end;
    gap: $spacing-base;
    max-width: $input-max-width;
  }

  &__preview-icon,
  &__preview-edit-indicator,
  &__preview-update-indicator {
    justify-self: end;
  }

  &__preview-edit-indicator {
    color: var(--a-base-1);
  }

  &__preview-update-indicator {
    color: var(--a-success);
  }

  &__disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}

.apos-separator {
  border-bottom: 1px solid var(--a-base-10);
}

.slide-fade-enter-active {
  transition: all 300ms ease-in;
}

.slide-fade-enter, .slide-fade-leave-to {
  transform: translateY(-5px);
  opacity: 0;
}
</style>
