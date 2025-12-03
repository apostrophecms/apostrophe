<template>
  <AposInputWrapper
    :modifiers="modifiers"
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-input-color">
        <AposColorInfo
          class="apos-input-color__info"
          :value="next"
          @clear="clear"
        />
        <div
          class="apos-input-color__ui"
          :class="{'apos-input-color__ui--micro': isMicro }"
        >
          <AposContextMenu
            :button="buttonOptions"
            menu-placement="bottom-start"
            identifier="color-button"
            :disabled="field.readOnly"
            :tooltip="tooltip"
            class="apos-input-color__sample-picker"
            :class="[
              { 'apos-input-color__sample-picker--selected': customSelected },
              { 'apos-input-color__sample-picker--no-value': !next }
            ]"
            @open="open"
            @close="close"
          >
            <AposColor
              :options="options"
              :model-value="pickerValue"
              @update:model-value="update"
            />
          </AposContextMenu>
          <button
            v-for="preset in finalOptions.presetColors"
            :key="preset"
            v-apos-tooltip="$t('apostrophe:colorFieldColorValue', { color: preset })"
            class="apos-input-color__preset-button"
            role="button"
            :aria-label="$t('apostrophe:colorFieldColorValue', { color: preset })"
            :class="{'apos-input-color__preset-button--selected': next === preset}"
            :style="`background-color: ${getColorStyle(preset)}`"
            @click="update(preset)"
          />
        </div>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputColorLogic from '../logic/AposInputColor';
import AposColorInfo from '../lib/AposColorInfo.vue';

export default {
  name: 'AposInputColor',
  components: {
    AposColorInfo
  },
  mixins: [ AposInputColorLogic ],
  computed: {
    customSelected() {
      return this.next && !this.finalOptions.presetColors.includes(this.next);
    }
  },
  methods: {
    getColorStyle(str) {
      return str.startsWith('--')
        ? `var(${str})`
        : str;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-input-color {
    display: flex;
    flex-direction: column;
    gap: $spacing-base;
  }

  .apos-input-color__preset-buttons {
    display: flex;
    gap: $spacing-half;
  }

  .apos-input-color__preset-button {
    all: unset;
    width: 40px;
    height: 40px;
    border-radius: 3px;
    border: 1px solid var(--a-base-8);
  }

  .apos-input-color__preset-button:active,
  .apos-input-color__preset-button:focus,
  .apos-input-color__sample-picker--selected:deep(.apos-button),
  .apos-input-color__preset-button--selected {
    outline: 2px solid var(--a-primary-transparent-50);
    outline-offset: 2px;
  }

  .apos-input-color__ui--micro .apos-input-color__preset-button,
  .apos-input-color__ui--micro .apos-input-color__sample-picker--selected {
    &:deep(.apos-button),
    &.apos-input-color__preset-button--selected,
    &:active, &:focus {
      outline-width: 2px;
      outline-offset: 0;
    }
  }

  .apos-input-color__sample-picker--no-value:deep(.apos-button__color-preview__sample) {
    display: none;
  }

  .apos-input-color__sample-picker--no-value:deep(.apos-button__color-preview__edit) {
    height: 100%;
  }

  .apos-input-color__ui {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-base;
  }

  .apos-input-color__preset-wrapper {
    display: contents;
  }

  .apos-input-color__ui--micro .apos-input-color__preset-wrapper {
    display: flex;
  }

</style>
