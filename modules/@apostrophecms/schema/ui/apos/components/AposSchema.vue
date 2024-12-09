<!--
  AposSchema takes an array of fields (`schema`), renders their inputs,
  and emits a new object with a `value` subproperty and a `hasErrors`
  subproperty via the input event whenever the value of a field
  or subfield changes.

  At mount time the fields are initialized from the subproperties of the
  `value.data` prop.

  For performance reasons, this component is not strictly v-model compliant.
  While all changes will emit an outgoing `input` event, the
  incoming `value` prop only updates the fields in three situations:

  1. At mount time, to set the initial values of the fields.

  2. When `value.data._id` changes (an entirely different document is in play).

  3. When the optional prop `generation` changes to a new number. This
  prop is also passed on to the individual input field components.

  If you need to force an update from the calling component, increment the
  `generation` prop. This should be done only if the value has changed for
  an external reason.
-->
<template>
  <component
    :is="fieldStyle === 'table' ? 'tr' : 'div'"
    class="apos-schema"
    :class="classes"
  >
    <slot name="before" />
    <component
      :is="fieldStyle === 'table' ? 'td' : 'div'"
      v-for="field in schema"
      :key="generateItemUniqueKey(field)"
      :data-apos-field="field.name"
      :style="(fieldStyle === 'table' && field.columnStyle) || {}"
      :class="{'apos-field--hidden': !displayComponent(field)}"
    >
      <component
        :is="fieldComponentMap[field.type]"
        :ref="field.name"
        v-model="fieldState[field.name]"
        :class="{ 'apos-field__wrapper--highlight': highlight(field.name) }"
        :following-values="followingValues[field.name]"
        :condition-met="conditionalFields?.if[field.name]"
        :field="fields[field.name].field"
        :meta="meta"
        :modifiers="fields[field.name].modifiers"
        :display-options="getDisplayOptions(field.name)"
        :trigger-validation="triggerValidation"
        :server-error="fields[field.name].serverError"
        :doc-id="docId"
        :generation="generation"
        @update:model-value="updateNextAndEmit"
        @update-doc-data="onUpdateDocData"
        @validate="emitValidate()"
      />
      <component
        :is="fieldComponentMap[field.type]"
        v-if="hasCompareMeta"
        v-show="displayComponent(field)"
        :ref="field.name"
        v-model="compareMetaState[field.name]"
        :class="{ 'apos-field__wrapper--highlight': highlight(field.name) }"
        :following-values="followingValues[field.name]"
        :condition-met="conditionalFields?.if[field.name]"
        :field="fields[field.name].field"
        :meta="meta"
        :modifiers="fields[field.name].modifiers"
        :display-options="getDisplayOptions(field.name)"
        :trigger-validation="triggerValidation"
        :server-error="fields[field.name].serverError"
        :doc-id="docId"
        :generation="generation"
        @update-doc-data="onUpdateDocData"
        @validate="emitValidate()"
      />
    </component>
    <slot name="after" />
  </component>
</template>

<script>
import AposSchemaLogic from '../logic/AposSchema';
export default {
  name: 'AposSchema',
  mixins: [ AposSchemaLogic ]
};
</script>

<style lang="scss" scoped>
  .apos-schema {
    line-height: var(--a-line-base);
  }

  .apos-schema :deep(.apos-field__wrapper) {
    max-width: $input-max-width;
  }

  .apos-schema :deep(.apos-field__wrapper.apos-field__wrapper--full-width) {
    max-width: inherit;
  }

  .apos-schema :deep(img) {
    max-width: 100%;
  }

  .apos-schema .apos-field--hidden {
    display: none;
  }

  .apos-schema :deep(.apos-field) {
    margin-bottom: $spacing-quadruple;

    &.apos-field--small,
    &.apos-field--micro,
    &.apos-field--margin-micro {
      margin-bottom: $spacing-double;
    }

    &.apos-field--margin-none {
      margin-bottom: 0;
    }
  }

  .apos-field .apos-schema :deep(.apos-toolbar) {
    margin-bottom: 0;
  }

  .apos-schema.apos-schema--compare > :deep([data-apos-field]) {
    display: flex;

    &.apos-field--hidden {
      display: none;
    }

    & > .apos-field__wrapper {
      flex-basis: 50%;
      flex-grow: 1;
      padding-right: 20px;
      border-right: 1px solid var(--a-base-9);
    }

    & > .apos-field__wrapper + .apos-field__wrapper {
      padding-right: 0;
      padding-left: 20px;
      border-right: none;
    }

    & .apos-field__label {
      word-break: break-all;
    }
  }

  :deep(.apos-field__wrapper--highlight > .apos-field) {
    padding: 10px;
    background: var(--a-highlight);
  }
</style>
