<template>
  <AposInputWrapper
    :field="field"
    :error="effectiveError"
    :uid="uid"
    :display-options="displayOptions"
    :modifiers="[...modifiers, 'full-width']"
    :meta="meta"
  >
    <template #body>
      <div
        class="apos-input-wrapper apos-input-rich-text"
        :class="{ 'apos-is-read-only': field.readOnly }"
        data-apos-test="richTextField"
      >
        <AposRichTextEditor
          :model-value="next"
          :options="field.options"
          :doc-id="docId"
          :read-only="field.readOnly"
          empty-label="apostrophe:emptyRichText"
          @update:model-value="update"
        />
      </div>
    </template>
  </AposInputWrapper>
</template>

<script>
// Editor for the `richText` schema field type. The editing experience is
// entirely provided by `AposRichTextEditor`, which is also what the rich
// text widget uses, so a rich text field and a rich text widget behave the
// same way and honor the same options.
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import textValue from 'Modules/@apostrophecms/schema/lib/textValue.js';

export default {
  name: 'AposInputRichText',
  mixins: [ AposInputMixin ],
  emits: [ 'update:modelValue' ],
  data() {
    return {
      // Overrides the mixin, to refuse a stale object. See `watchValue`
      next: textValue(
        (this.modelValue?.data !== undefined) ? this.modelValue.data : ''
      )
    };
  },
  methods: {
    // A stale object, e.g. an area that once had this field's name, is
    // edited as an empty value. See `textValue`
    watchValue() {
      this.error = this.modelValue.error;
      this.next = textValue(this.modelValue.data);
    },
    update(content) {
      if (this.field.readOnly) {
        return;
      }
      this.next = content;
    },
    validate(value) {
      if (this.field.required && this.isEmpty(value)) {
        return 'required';
      }
      return false;
    },
    // Mirrors the `isEmptyRichText` method of the rich text widget module,
    // so that the browser and the server agree about what an empty rich
    // text field looks like. Tables and figures count as content even
    // though they contain no text of their own
    isEmpty(value) {
      const content = (value || '').trim();
      if (content.includes('<table') || content.includes('<figure')) {
        return false;
      }
      const div = document.createElement('div');
      div.innerHTML = content;
      return !(div.textContent || '').trim().length;
    },
    getEmptyValue() {
      return '';
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-input-rich-text {
    padding: 0 $spacing-base;
    border: 1px solid var(--a-base-8);
    border-radius: var(--a-border-radius);
    background-color: var(--a-background-primary);

    &:focus-within {
      border-color: var(--a-base-2);
    }

    &.apos-is-read-only {
      background-color: var(--a-base-10);
    }
  }
</style>
