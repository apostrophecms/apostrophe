<template>
  <AposInputWrapper
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :display-options="displayOptions"
    :modifiers="modifiers"
  >
    <template #body>
=      <AposRichTextEditor
        :options="field.options"
        :model-value="value"
        :doc-id="null"
        :id="uid"
        @update="change" />
    </template>
  </AposInputWrapper>
</template>

<script>
import AposRichTextEditor from 'Modules/@apostrophecms/rich-text-widget/components/AposRichTextEditor.vue';
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';

export default {
  name: 'AposInputRichText',
  mixins: [ AposInputMixin ],
  methods: {
    validate(value) {
      if (this.field.required && !value.length) {
        return 'required';
      }
      return false;
    },
    change(value) {
      this.next = value;
    }
  }
};
</script>
