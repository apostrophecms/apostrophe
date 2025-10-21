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
          class="apos-input-color__info apos-input-color__info--inline"
          :value="next"
          :is-micro="isMicro"
          @clear="clear"
        />
        <div class="apos-input-color__ui">
          <AposContextMenu
            :button="buttonOptions"
            menu-placement="bottom-start"
            :disabled="field.readOnly"
            :tooltip="tooltip"
            class="apos-input-color__sample-picker"
            :class="{'apos-input-color__sample-picker--selected': customSelected}"
            @open="open"
            @close="close"
          >
            <AposColor
              :options="options"
              :model-value="pickerValue"
              @update:model-value="update"
            />
          </AposContextMenu>
          <!-- TODO guard against inline? -->
          <button
            v-for="preset in presets"
            :key="preset"
            v-apos-tooltip="preset"
            class="apos-input-color__preset-button"
            role="button"
            :aria-label="$t('apostrophe:colorFieldSelectSwatch', { color: preset })"
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
const defaultOptions = { ...apos.modules['@apostrophecms/color-field'].defaultOptions };

export default {
  name: 'AposInputColor',
  components: {
    AposColorInfo
  },
  mixins: [ AposInputColorLogic ],
  computed: {
    presets() {
      if (this.options.presetColors) {
        return this.options.presetColors;
      } else {
        return defaultOptions.presetColors;
      }
    },
    customSelected() {
      return this.next && !this.presets.includes(this.next);
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
    // align-items: center;
  }

  .apos-input-color__info {
    margin-left: 15px;

    &--inline {
      margin-right: 5px;
      margin-left: 0;
    }
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

    &:active, &:focus {
      outline: 2px solid var(--a-primary-transparent-50);
      outline-offset: 2px;

      &--selected {
        box-shadow: var(--a-box-shadow);
      }
    }
  }

  .apos-input-color__sample-picker--selected:deep(.apos-button--color),
  .apos-input-color__preset-button--selected {
    outline: 2px solid var(--a-primary);
    outline-offset: 2px;
  }

  .apos-input-color__ui {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-base;
  }

</style>
