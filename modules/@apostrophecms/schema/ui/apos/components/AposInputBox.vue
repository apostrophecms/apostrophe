<template>
  <AposInputWrapper
    :modifiers="modifiers"
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :display-options="displayOptions"
    :meta="fieldMeta"
    @replace-field-value="replaceFieldValue"
  >
    <template #body>
      <div class="apos-input-wrapper">
        <div class="apos-input-box__wrapper">
          <div class="apos-input-box__shorthand">
            <input
              :id="`${uid}-shorthand`"
              v-model="shorthand"
              type="number"
              placeholder="0"
              class="apos-input apos-input--number"
              :disabled="field.readOnly || field.disabled"
              :required="field.required"
              :tabindex="tabindex"
              @change="reflectShorthand"
            >
            <div class="apos-input-box__switch">
              <button
                class="apos-input-box__switch__button apos-input-box__switch__button--shorthand"
                :class="{'active': mode === 'shorthand'}"
                aria-label="Edit all values"
              >
                <span class="apos-input-box__switch__diagram" />
              </button>
              <button
                class="apos-input-box__switch__button apos-input-box__switch__button--individual"
                :class="{'active': mode === 'individual'}"
                aria-label="Edit individual values"
              >
                <span class="apos-input-box__switch__diagram apos-input-box__switch__diagram--top" />
                <span class="apos-input-box__switch__diagram apos-input-box__switch__diagram--right" />
                <span class="apos-input-box__switch__diagram apos-input-box__switch__diagram--bottom" />
                <span class="apos-input-box__switch__diagram apos-input-box__switch__diagram--left" />
              </button>
            </div>
          </div>
        </div>
        <fieldset>
          <label>Shorthand</label>

        </fieldset>
        <fieldset>
          <label>Top</label>
          <input
            :id="`${uid}-top`"
            v-model="next['top']"
            type="number"
            placeholder="0"
            :disabled="field.readOnly || field.disabled"
            :required="field.required"
            :tabindex="tabindex"
            @change="event => update(event.target.value, 'top')"
          >
        </fieldset>
        <fieldset>
          <label>Right</label>
          <input
            :id="`${uid}-right`"
            v-model="next['right']"
            type="number"
            placeholder="0"
            :disabled="field.readOnly || field.disabled"
            :required="field.required"
            :tabindex="tabindex"
            @change="event => update(event.target.value, 'right')"
          >
        </fieldset>
        <fieldset>
          <label>Bottom</label>
          <input
            :id="`${uid}-bottom`"
            v-model="next['bottom']"
            type="number"
            placeholder="0"
            :disabled="field.readOnly || field.disabled"
            :required="field.required"
            :tabindex="tabindex"
            @change="event => update(event.target.value, 'bottom')"
          >
        </fieldset>
        <fieldset>
          <label>Left</label>
          <input
            :id="`${uid}-left`"
            v-model="next['left']"
            type="number"
            placeholder="0"
            :disabled="field.readOnly || field.disabled"
            :required="field.required"
            :tabindex="tabindex"
            @change="event => update(event.target.value, 'left')"
          >
        </fieldset>
        current value {{ JSON.stringify(next) }}
        <!--
        <component
          :is="icon"
          v-if="icon"
          :size="iconSize"
          class="apos-input-icon"
        />
        -->
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
import AposInputBoxLogic from '../logic/AposInputBox';
export default {
  name: 'AposInputBox',
  mixins: [ AposInputBoxLogic ]
};
</script>

<style lang="scss" scoped>
  .apos-input-box__wrapper {
    max-width: 350px;
  }

  .apos-input-box__shorthand {
    display: flex;
  }

  .apos-input-box__switch__button {
    all: unset;
    height: 34px;
    width: 34px;
  }
</style>
