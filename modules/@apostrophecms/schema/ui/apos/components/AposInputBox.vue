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
        <fieldset>
          <label>Shorthand</label>
          <input
            :id="`${uid}-shorthand`"
            v-model="shorthand"
            type="number"
            placeholder="0"
            :disabled="field.readOnly || field.disabled"
            :required="field.required"
            :tabindex="tabindex"
            @change="reflectShorthand"
          >
        </fieldset>
        <fieldset>
          <label>Top</label>
          <input
            :id="`${uid}-top`"
            v-model="top"
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
            v-model="right"
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
            v-model="bottom"
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
            v-model="left"
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

</style>
