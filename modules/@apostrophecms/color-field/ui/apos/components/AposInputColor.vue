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
              v-bind="pickerOptions"
              :model-value="pickerValue"
              @update:model-value="update"
            />
          </AposContextMenu>
        </div>
        <div class="apos-input-color__info" data-apos-test="colorInfo">
          {{ valueLabel }}
          <AposButton
            v-if="next"
            type="quiet"
            label="apostrophe:clear"
            class="apos-input-color__clear"
            :modifiers="['no-motion']"
            @click="clear"
          />
        </div>
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputColorLogic from '../logic/AposInputColor';
export default {
  name: 'AposInputColor',
  mixins: [ AposInputColorLogic ]
};
</script>

<style lang="scss" scoped>
  .apos-input-color {
    display: flex;
    align-items: center;
  }

  .apos-input-color__clear {
    margin-left: 10px;
  }

  .apos-input-color__info {
    @include type-base;

    & {
      margin-left: 15px;
      color: var(--a-text-primary);
    }
  }
</style>
