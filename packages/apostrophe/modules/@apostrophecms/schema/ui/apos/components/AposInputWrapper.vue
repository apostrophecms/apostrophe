<template>
  <div
    class="apos-field__wrapper"
    :class="{
      [`apos-field__wrapper--${field.type}`]: true,
      'apos-field__wrapper--full-width': modifiers.includes('full-width'),
      'apos-field__wrapper--outside': outsideState,
      'apos-field__wrapper--busy': outsideState?.busy
    }"
    :aria-busy="outsideState?.busy ? 'true' : null"
  >
    <!-- Out of reach while busy: its value is about to be replaced -->
    <component
      :is="wrapEl"
      :class="classList"
      :inert="isOutsideInert || null"
    >
      <div class="apos-field__info">
        <!-- Beside the label, never in it: not part of the field's name -->
        <transition name="apos-field__ai-mark">
          <AposAiMark
            v-if="outsideState && field.label && !field.hideLabel"
            class="apos-field__ai-mark"
            :busy="outsideState.busy"
          />
        </transition>
        <component
          :is="labelEl"
          v-if="field.label"
          class="apos-field__label"
          :class="{
            'apos-sr-only': field.hideLabel,
            'apos-field__label--meta-left':
              field.meta && field.meta.position === 'left',
          }"
          :for="uid"
          :data-apos-test-name="field.name"
          :data-apos-test-label="$t(label, field.labelInterpolation)"
          data-apos-test="field-label"
        >
          <span class="apos-field_label-info">
            {{ $t(label, field.labelInterpolation) }}
            <span
              v-if="field.required"
              class="apos-field__required"
            >
              * </span>
            <AposLabel
              v-if="field.tag"
              class="apos-field__tag"
              :label="field.tag.value || field.tag"
              :modifiers="[
                `apos-is-${field.tag.type || 'success'}`,
                'apos-is-filled',
              ]"
              data-apos-test="field-tag"
            />
            <span
              v-if="(field.help || field.htmlHelp) && displayOptions.helpTooltip"
              data-apos-test="field-help-tooltip"
              class="apos-field__help-tooltip"
            >
              <AposIndicator
                icon="help-circle-icon"
                class="apos-field__help-tooltip__icon"
                :tooltip="$t(field.help || field.htmlHelp)"
                :icon-size="11"
                icon-color="var(--a-base-4)"
              />
            </span>
            <span
              v-if="displayOptions.changed"
              class="apos-field__changed"
              data-apos-test="field-changed"
            >
              <AposLabel
                label="apostrophe:changed"
                class="apos-field__changed__label"
                :modifiers="['apos-is-warning', 'apos-is-filled']"
                tooltip="apostrophe:fieldHasUnpublishedChanges"
              />
            </span>
          </span>
          <div>
            <div
              v-if="hasExtraInfo"
              class="apos-field__label-extra-info"
            >
              <slot name="info" />
            </div>
            <span
              data-apos-test="field-meta-wrapper"
              class="apos-field__label-meta"
            >
              <slot name="meta">
                <component
                  :is="name"
                  v-for="{ name, namespace, data } in metaComponents"
                  :key="name"
                  :field="field"
                  :items="items"
                  :namespace="namespace"
                  :meta="data"
                  :meta-raw="meta"
                  :data-apos-test-component="name"
                  :data-apos-test-namespace="namespace"
                  data-apos-test="field-meta"
                  @replace-field-value="replaceFieldValue"
                />
              </slot>
            </span>
          </div>
        </component>
        <!-- eslint-disable vue/no-v-html -->
        <p
          v-if="(field.help || field.htmlHelp) && !displayOptions.helpTooltip"
          class="apos-field__help"
          v-html="$t(field.help || field.htmlHelp, field.helpInterpolation)"
        />
        <slot name="additional" />
      </div>
      <slot name="body" />
      <div
        v-if="errorMessage"
        class="apos-field__error"
        data-apos-test="field-error"
      >
        {{ getTranslatedErrorMessage(errorMessage) }}
      </div>
    </component>
    <!-- CSS Escape hatch for additional interfaces like relationship managers -->
    <slot name="secondary" />
  </div>
</template>

<script>
import AposInputWrapperLogic from '../logic/AposInputWrapper';
export default {
  name: 'AposInputWrapper',
  mixins: [ AposInputWrapperLogic ],
  methods: {
    getTranslatedErrorMessage(message) {
      if (message === 'required') {
        return this.$t('apostrophe:required');
      }
      if (message === 'invalid') {
        return this.$t('apostrophe:invalid');
      }
      return this.$t(message);
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-field__wrapper {
  position: relative;
}

.apos-field__wrapper.apos-field__wrapper--full-width {
  max-width: 100%;
}

// Room for the mark at the start of the label line
.apos-field__wrapper--outside > .apos-field > .apos-field__info {
  position: relative;

  > .apos-field__label {
    padding-left: 20px;
  }
}

.apos-field__ai-mark {
  position: absolute;
  top: 1px;
  left: 0;
}

.apos-field__ai-mark-enter-active,
.apos-field__ai-mark-leave-active {
  transition: opacity 220ms ease-out, transform 220ms ease-out;
}

.apos-field__ai-mark-enter-from,
.apos-field__ai-mark-leave-to {
  opacity: 0;
  transform: scale(0.5);
}

// A field AI is about to change: dimmed and out of reach until its value
// lands, then back in a fade
.apos-field__wrapper--outside > .apos-field > :deep(:not(.apos-field__info, .apos-field__error)) {
  transition: opacity 360ms ease-out;
}

.apos-field__wrapper--busy > .apos-field > :deep(:not(.apos-field__info, .apos-field__error)) {
  opacity: 0.4;
  pointer-events: none;
}

.apos-field {
  border-width: 0;
  padding: 0;

  [disable]:hover,
  [disabled] ~ .apos-choice-label-text:hover {
    cursor: not-allowed;
  }
}

.apos-field--text {
  @include type-base;
}

.apos-field__label {
  @include type-label;

  & {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: space-between;
    margin: 0 0 $spacing-base;
    padding: 0;
    color: var(--a-text-primary);
    gap: $spacing-double;
  }

  &.apos-field__label--meta-left {
    justify-content: flex-start;
    gap: $spacing-base;

    .apos-field__label-meta {
      order: 1;
    }

    .apos-field_label-info {
      order: 2;
    }
  }

  &-info {
    display: block;
  }

  &-meta {
    display: inline-flex;
    align-items: center;
    gap: $spacing-half;
    justify-content: flex-end;
  }
}

.apos-field__label-meta:empty {
  display: none;
}

.apos-field__help {
  @include type-base;

  & {
    margin: 0 0 $spacing-base;
    line-height: var(--a-line-tall);
    color: var(--a-base-2);
  }
}

.apos-field__help-tooltip__icon {
  position: relative;
}

.apos-field__changed {
  position: relative;
  top: -2px;
  margin-left: $spacing-half;
}

.apos-field__error {
  @include type-help;

  & {
    margin: $spacing-base 0;
    color: var(--a-danger);
  }
}

.apos-field__required {
  color: var(--a-danger);
}

.apos-field__tag {
  margin-left: 5px;
}

.apos-field__help-tooltip {
  position: relative;
  top: 2px;
}

.apos-field--inline {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .apos-field__label {
    margin-bottom: 0;
  }

  .apos-field__info {
    margin-right: 30px;
  }

  .apos-field__info {
    flex-shrink: 1;
  }

  .apos-input-wrapper {
    flex-grow: 1;
  }

  &.apos-field--range {
    display: block;

    .apos-range__input {
      margin: 5px 0 0;
    }

    .apos-range__scale {
      margin-top: 0;
    }

    .apos-range__value {
      padding-top: 9px;
    }

    .apos-field__info {
      margin: 0 0 5px;
    }

    .apos-field__info,
    .apos-input-wrapper {
      width: 100%;
    }
  }
}

/* stylelint-disable-next-line media-feature-name-allowed-list */
@media (prefers-reduced-motion: reduce) {
  .apos-field__ai-mark-enter-active,
  .apos-field__ai-mark-leave-active,
  .apos-field__wrapper--outside > .apos-field > :deep(:not(.apos-field__info, .apos-field__error)) {
    transition: none;
  }
}
</style>
