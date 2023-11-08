<template>
  <AposInputWrapper
    :modifiers="modifiers" :field="field"
    :error="effectiveError" :uid="uid"
    :display-options="displayOptions"
  >
    <template #body>
      <div class="apos-color">
        <div class="apos-color__ui">
          <AposContextMenu
            :button="buttonOptions"
            @open="open"
            @close="close"
            menu-placement="bottom-start"
            menu-offset="5, 20"
            :disabled="field.readOnly"
            :tooltip="tooltip"
          >
            <Picker
              v-bind="pickerOptions"
              :value="next"
              @input="update"
            />
          </AposContextMenu>
        </div>
        <div class="apos-color__info">
          {{ valueLabel }}
          <AposButton
            v-if="next"
            type="quiet" label="apostrophe:clear"
            class="apos-color__clear"
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
  .apos-color {
    display: flex;
    align-items: center;
  }

  .apos-color__clear {
    margin-left: 10px;
  }

  .apos-color__info {
    @include type-base;
    margin-left: 15px;
    color: var(--a-text-primary);
  }
</style>

<!--
  This styleblock is unscoped so that it reaches the color field's implementation
  of AposContextMenu, which is outside the component's DOM tree
-->
<style lang="scss">
  .apos-popover .vc-sketch {
    padding: 0;
    box-shadow: none;
  }
</style>
