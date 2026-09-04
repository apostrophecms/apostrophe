<template>
  <AposRichTextEditor
    class="apos-wysiwyg-rich-text"
    inline
    :model-value="next"
    :options="field.options"
    :doc-id="docId"
    :read-only="readOnly"
    empty-label="apostrophe:emptyRichText"
    data-apos-test="wysiwygRichText"
    @update:model-value="update"
  />
</template>

<script>
// Edits a `richText` field in place, per the `{% field %}` custom tag. The
// editing experience is the one provided by `AposRichTextEditor`, which is
// also what a rich text widget and a rich text field in a modal use, so all
// three honor the same options and behave the same way.
//
// `AposRichTextEditor` debounces its own updates and emits `context-editing`
// while the user types, so `update` saves each value it is handed.
//
// `inline` asks the editor for none of the padding and spacing it wears in a
// widget or a modal, so that it takes up exactly the room the markup it
// replaced did and the text does not move when editing begins.
import AposWysiwygInputMixin from 'Modules/@apostrophecms/schema/mixins/AposWysiwygInputMixin';

export default {
  name: 'AposWysiwygInputRichText',
  mixins: [ AposWysiwygInputMixin ]
};
</script>
