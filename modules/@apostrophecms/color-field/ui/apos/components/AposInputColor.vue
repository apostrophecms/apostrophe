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
          v-if="isInline"
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
          <div
            v-if="presets"
            class="apos-input-color__preset-buttons"
          >
            <button
              v-for="preset in presets"
              :key="preset"
              class="apos-input-color__preset-button"
              :style="`background-color:${preset}`"
              @click="update(preset)"
            />
          </div>
        </div>
        <!-- <AposColorInfo
          v-if="!isInline"
          class="apos-input-color__info"
          :value="next"
          :is-micro="isMicro"
          @clear="clear"
        /> -->
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
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-input-color {
    display: flex;
    align-items: center;
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
    width: 25px;
    height: 25px;
    border-radius: 50%;
    outline: 1px solid var(--a-base-8);
  }

  .apos-input-color__ui {
    display: flex;
  }

</style>
