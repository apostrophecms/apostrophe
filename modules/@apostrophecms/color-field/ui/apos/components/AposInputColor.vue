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
        </div>
        <AposColorInfo
          v-if="!isInline"
          class="apos-input-color__info"
          :value="next"
          :is-micro="isMicro"
          @clear="clear"
        />
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
  mixins: [ AposInputColorLogic ]
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

</style>
