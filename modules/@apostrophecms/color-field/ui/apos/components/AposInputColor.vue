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
        <div class="apos-input-color__info">
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
import AposColor from './AposColor';
export default {
  name: 'AposInputColor',
  components: [
    AposColor
  ],
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

  :deep(.apos-popover .apos-color) {
    padding: 0;
    box-shadow: none;
  }
</style>

<!--
  This styleblock is unscoped so that it reaches the color field's implementation
  of AposContextMenu, which is outside the component's DOM tree
-->
<!-- <style lang="scss">
  .apos-popover .vc-sketch {
    padding: 0;
    box-shadow: none;
  }
</style> -->
