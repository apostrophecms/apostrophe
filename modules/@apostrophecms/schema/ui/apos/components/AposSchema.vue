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
    class="apos-schema"
    :is="fieldStyle === 'table' ? 'tr' : 'div'"
  >
    <slot name="before" />
    <component
      v-for="field in schema" :key="field.name.concat(field._id ?? '')"
      :data-apos-field="field.name"
      :is="fieldStyle === 'table' ? 'td' : 'div'"
      v-show="displayComponent(field)"
    >
      <component
        v-show="displayComponent(field)"
        v-model="fieldState[field.name]"
        :is="fieldComponentMap[field.type]"
        :following-values="followingValues[field.name]"
        :condition-met="conditionalFields[field.name]"
        :field="fields[field.name].field"
        :modifiers="fields[field.name].modifiers"
        :display-options="getDisplayOptions(field.name)"
        :trigger-validation="triggerValidation"
        :server-error="fields[field.name].serverError"
        :doc-id="docId"
        :ref="field.name"
        :generation="generation"
        @update-doc-data="onUpdateDocData"
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
  .apos-schema ::v-deep .apos-field__wrapper {
    max-width: $input-max-width;
  }
  .apos-schema ::v-deep .apos-field__wrapper.apos-field__wrapper--full-width {
    max-width: inherit;
  }

  .apos-schema ::v-deep .apos-field__wrapper--area {
    max-width: 100%;
  }

  .apos-schema ::v-deep img {
    max-width: 100%;
  }

  .apos-field {
    .apos-schema ::v-deep & {
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

    .apos-schema ::v-deep .apos-toolbar & {
      margin-bottom: 0;
    }
  }
</style>
