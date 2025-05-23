<template>
  <AposInputWrapper
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :items="next"
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
        :model-value="next"
      />
    </template>
    <template #body>
      <div class="apos-input-wrapper apos-input-relationship">
        <div class="apos-input-relationship__input-wrapper">
          <input
            v-if="!modifiers.includes('no-search')"
            :id="uid"
            v-model="searchTerm"
            class="apos-input apos-input--text apos-input--relationship"
            type="text"
            role="combobox"
            :aria-owns="`apos-relationship-${field._id}`"
            :aria-expanded="!!searchList.length"
            aria-autocomplete="both"
            :placeholder="$t(placeholder)"
            :disabled="field.readOnly || limitReached"
            :required="field.required"
            tabindex="0"
            @input="input"
            @focus="input"
            @focusout="handleFocusOut"
            @keydown="handleKeydown"
          >
          <AposButton
            v-if="field.browse !== false"
            class="apos-input-relationship__button"
            :disabled="field.readOnly"
            :label="browseLabel"
            :modifiers="buttonModifiers"
            type="input"
            :attrs="{'data-apos-focus-priority': true}"
            @click="choose"
          />
        </div>
        <AposSlatList
          v-if="next.length"
          class="apos-input-relationship__items"
          :model-value="next"
          :duplicate="duplicate"
          :disabled="field.readOnly"
          :relationship-schema="field.schema"
          :editor-label="field.editorLabel"
          :editor-icon="field.editorIcon"
          @update:model-value="updateSelected"
          @item-clicked="editRelationship"
        />
        <AposSearchList
          :aria-id="`apos-relationship-${field._id}`"
          :list="searchList"
          :selected-items="next"
          :icon="field.suggestionIcon"
          :icon-size="field.suggestionIconSize"
          :fields="suggestionFields"
          :focus-index="searchFocusIndex"
          :suggestion="searchSuggestion"
          :hint="searchHint"
          disabled-tooltip="apostrophe:publishBeforeUsingTooltip"
          @select="updateSelected"
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
    // Disable z-index because it breaks context menus that originate from
    // a fixed position elements (AposModalLip).
    // z-index: $z-index-widget-focused-controls;
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

    & {
      display: flex;
      flex-grow: 1;
      margin-bottom: $spacing-base;
      font-weight: var(--a-weight-bold);
    }
  }
</style>
