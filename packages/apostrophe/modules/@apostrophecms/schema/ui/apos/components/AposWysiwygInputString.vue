<template>
  <div
    class="apos-wysiwyg-string"
    :class="{
      'apos-wysiwyg-string--multiline': field.textarea,
      'apos-wysiwyg-string--read-only': readOnly,
      'apos-wysiwyg-string--empty': !next
    }"
    :data-replicated-value="next"
    data-apos-test="wysiwygString"
  >
    <textarea
      ref="textarea"
      class="apos-wysiwyg-string__input"
      rows="1"
      cols="1"
      spellcheck="true"
      :value="next"
      :placeholder="placeholder"
      :readonly="readOnly"
      :aria-label="placeholder"
      @input="onInput"
      @keydown.enter="onEnter"
      @paste="onPaste"
      @blur="flush"
    />
  </div>
</template>

<script>
// Edits a `string` field in place, per the `{% field %}` custom tag.
//
// The textarea inherits everything about the way text looks from the element
// the tag rendered, so that editing feels like typing on the page rather than
// filling in a form. It grows to fit its content: the value is replicated into
// the wrapper's `::after` pseudo-element, which occupies the same grid cell,
// so the wrapper is always exactly as tall as the text and the textarea
// stretches to it. No measuring, no resize observers.
//
// A `textarea: true` string accepts line breaks. Any other string is a single
// line, so Enter is refused and pasted line breaks collapse to spaces, but it
// still wraps rather than scrolling sideways the way an `input` would.
//
// `cols="1"` for the same reason: a textarea is 20 characters wide when asked
// how wide it would like to be, which is only ever asked where the answer
// matters, e.g. a field rendered inline. The replicated text answers instead,
// and the textarea stretches to whatever it says.
import AposWysiwygInputMixin from 'Modules/@apostrophecms/schema/mixins/AposWysiwygInputMixin';

export default {
  name: 'AposWysiwygInputString',
  mixins: [ AposWysiwygInputMixin ],
  methods: {
    onInput(event) {
      const value = this.field.textarea
        ? event.target.value
        : this.collapse(event.target.value);
      if (value !== event.target.value) {
        event.target.value = value;
      }
      this.updateDebounced(value);
    },
    onEnter(event) {
      if (this.field.textarea) {
        return;
      }
      // A single line field: Enter means "I'm done", not "new paragraph"
      event.preventDefault();
      event.target.blur();
    },
    onPaste(event) {
      if (this.field.textarea) {
        return;
      }
      const text = event.clipboardData?.getData('text/plain');
      if (!text || !text.includes('\n')) {
        return;
      }
      event.preventDefault();
      const el = event.target;
      const { selectionStart: start, selectionEnd: end } = el;
      const collapsed = this.collapse(text);
      el.value = el.value.slice(0, start) + collapsed + el.value.slice(end);
      el.selectionStart = el.selectionEnd = start + collapsed.length;
      this.updateDebounced(el.value);
    },
    collapse(value) {
      return value.replace(/\s*\r?\n\s*/g, ' ');
    }
  }
};
</script>

<style lang="scss" scoped>
  // The textarea and the replicated text share one grid cell, so the wrapper
  // takes the height of whichever is taller, which is always the text
  .apos-wysiwyg-string {
    display: grid;

    &::after {
      content: attr(data-replicated-value) ' ';
      visibility: hidden;
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }

    &::after,
    .apos-wysiwyg-string__input {
      // Everything about the text is the page's business, not ours. `font`
      // covers the family, size, weight, style and line height
      color: inherit;
      font: inherit;
      letter-spacing: inherit;
      text-align: inherit;
      text-transform: inherit;
      grid-area: 1 / 1 / 2 / 2;
    }
  }

  .apos-wysiwyg-string__input {
    overflow: hidden;
    margin: 0;
    padding: 0;
    border: 0;
    background-color: transparent;
    resize: none;
    outline: none;

    &::placeholder {
      color: inherit;
      opacity: 0.4;
    }

    &:read-only {
      cursor: default;
    }
  }

  // Without this an empty field would be invisible and impossible to click
  .apos-wysiwyg-string--empty {
    min-width: 4em;
  }
</style>
