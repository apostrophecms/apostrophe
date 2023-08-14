<template>
  <AposInputWrapper
    :field="field" :error="effectiveError"
    :uid="uid" :items="next"
    :display-options="displayOptions"
    :modifiers="modifiers"
  >
    <template #additional>
      <div
        v-if="minSize[0] || minSize[1]"
        class="apos-field__min-size"
      >
        {{
          $t('apostrophe:minSize', {
            width: minSize[0] || '???',
            height: minSize[1] || '???'
          })
        }}
      </div>
      <AposMinMaxCount
        v-if="field.max > 1"
        :field="field"
        :value="next"
      />
    </template>
    <template #body>
      <div class="apos-input-wrapper apos-input-relationship">
        <div class="apos-input-relationship__input-wrapper">
          <input
            v-if="!modifiers.includes('no-search')"
            class="apos-input apos-input--text apos-input--relationship"
            v-model="searchTerm" type="text"
            :placeholder="$t(placeholder)"
            :disabled="field.readOnly || limitReached"
            :required="field.required"
            :id="uid"
            @input="input"
            @focus="input"
            @focusout="handleFocusOut"
            tabindex="0"
          >
          <AposButton
            class="apos-input-relationship__button"
            v-if="field.browse !== false"
            :disabled="field.readOnly || limitReached"
            :label="browseLabel"
            :modifiers="buttonModifiers"
            type="input"
            @click="choose"
          />
        </div>
        <AposSlatList
          class="apos-input-relationship__items"
          v-if="next.length"
          @input="updateSelected"
          @item-clicked="editRelationship"
          :value="next"
          :duplicate="duplicate"
          :disabled="field.readOnly"
          :relationship-schema="field.schema"
          :editor-label="field.editorLabel"
          :editor-icon="field.editorIcon"
        />
        <AposSearchList
          :list="searchList"
          @select="updateSelected"
          :selected-items="next"
          :icon="field.suggestionIcon"
          :icon-size="field.suggestionIconSize"
          :fields="field.suggestionFields"
          disabled-tooltip="apostrophe:publishBeforeUsingTooltip"
        />
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputRelationshipLogic from '../logic/AposInputRelationship';
export default {
  name: 'AposInputRelationship',
  mixins: [ AposInputRelationshipLogic ]
};
</script>

<style lang="scss" scoped>
  .apos-input-relationship__input-wrapper {
    z-index: $z-index-widget-focused-controls;
    position: relative;

    .apos-input-relationship__button {
      position: absolute;
      top: 0;
      right: 0;
      padding: ($input-padding - 5px) $input-padding;

      &:hover:not([disabled]),
      &:focus:not([disabled]) {
        transform: none;
      }
    }
  }

  .apos-input-relationship__items {
    position: relative;
    margin-top: $spacing-base;
  }

  .apos-field--small {
    .apos-input-relationship__button {
      padding: $spacing-half;
    }
  }
  .apos-field--no-search {
    .apos-input-relationship__button {
      position: relative;
      width: 100%;
      padding: 0;
    }
  }

  .apos-field__min-size {
    @include type-help;
    display: flex;
    flex-grow: 1;
    margin-bottom: $spacing-base;
    font-weight: var(--a-weight-bold);
  }
</style>
