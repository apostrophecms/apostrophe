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
      @blur="onBlur"
      @focus="sendAwareness"
      @select="sendAwareness"
      @keyup="sendAwareness"
      @mouseup="sendAwareness"
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
//
// When several people may edit the document at once, the value is kept in
// step with everyone else's typing by a `TextSync`, with a `StringModel`
// standing in for a rich text editor: see `startCollab`.
import { createId } from 'apostrophe/lib/beneath.js';
import AposWysiwygInputMixin from 'Modules/@apostrophecms/schema/mixins/AposWysiwygInputMixin';
import TextSync from 'Modules/@apostrophecms/collab/lib/text-sync.js';
import StringModel from 'Modules/@apostrophecms/collab/lib/string-model.js';
import * as editorRegistry from 'Modules/@apostrophecms/rich-text-widget/lib/editor-registry.js';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget';
import { colorFor } from 'Modules/@apostrophecms/collab/stores/collab.js';

export default {
  name: 'AposWysiwygInputString',
  mixins: [ AposWysiwygInputMixin ],
  mounted() {
    if (this.collabSession && !this.readOnly) {
      this.startCollab();
    }
  },
  beforeUnmount() {
    if (this.textSync) {
      this.textSync.destroy();
      this.textSync = null;
      editorRegistry.unregister(this.historyKey);
    }
  },
  methods: {
    onInput(event) {
      const value = this.field.textarea
        ? event.target.value
        : this.collapse(event.target.value);
      if (value !== event.target.value) {
        event.target.value = value;
      }
      if (this.textSync) {
        this.typed(value, event.target);
      }
      this.updateDebounced(value);
    },
    onBlur() {
      this.flush();
      this.textSync?.checkpoint();
    },
    startCollab() {
      this.historyKey = createId();
      this.typedBeforeCollab = false;
      this.model = new StringModel({
        value: this.next || '',
        onChange: this.onModelChange
      });
      editorRegistry.register(this.historyKey, {
        target: this.patchKey,
        el: this.$el,
        flush: () => this.flush(),
        collabHistory: direction => {
          if (direction === 'undo') {
            this.model.undo();
          } else {
            this.model.redo();
          }
          this.$refs.textarea?.focus();
        }
      });
      const model = this.model;
      this.textSync = new TextSync({
        key: this.patchKey,
        session: this.collabSession,
        host: {
          getState: () => model.getState(),
          dispatch: tr => model.dispatch(tr),
          registerPlugin: plugin => model.registerPlugin(plugin),
          unregisterPlugin: name => model.unregisterPlugin(name),
          setContent: content => model.setContent(content),
          getValue: () => model.getValue(),
          afterInit: () => {
            if (this.typedBeforeCollab && ((this.next || '') !== model.value)) {
              // Apply again what was typed while we waited
              this.typed(this.next || '', this.$refs.textarea);
            } else {
              this.showValue(model.value);
            }
          },
          onReset: () => this.showValue(model.value),
          onRemote: (tr, batch) => this.flashChange(batch)
        }
      });
    },
    // The user changed the text: record it as a step, for everyone else and
    // for undo
    typed(value, el) {
      if (!this.textSync.ready) {
        this.typedBeforeCollab = true;
        return;
      }
      const depth = this.model.undoDepth();
      const tr = this.model.setValue(value, el
        ? {
          start: el.selectionStart,
          end: el.selectionEnd
        }
        : null);
      if (!tr) {
        return;
      }
      this.textSync.localChanged();
      apos.bus.$emit('context-history-record', {
        collab: true,
        newGroup: this.model.undoDepth() > depth,
        instanceKey: this.historyKey,
        target: this.patchKey
      });
    },
    // The value changed other than by typing: someone else's typing, or undo
    onModelChange(value, { remote, selection }) {
      const el = this.$refs.textarea;
      const focused = el && (document.activeElement === el);
      if (el) {
        el.value = value;
        if (focused) {
          el.setSelectionRange(selection.start, selection.end);
        }
      }
      if (!remote) {
        this.textSync.localChanged();
      }
      this.showValue(value);
    },
    // Show `value`, and let everything holding a copy of it hear about it
    showValue(value) {
      if (value === this.next) {
        return;
      }
      this.next = value;
      this.lastSaved = value;
      this.save();
    },
    // Point out someone else's change, in their color, for a moment
    flashChange(batch) {
      const el = this.$el;
      if (!el) {
        return;
      }
      el.style.setProperty('--apos-collab-color', colorFor(batch.userId));
      el.setAttribute('data-apos-collab-name', batch.title || '');
      el.classList.remove('apos-collab-marker');
      // Reading the layout restarts the animation
      el.getBoundingClientRect();
      el.classList.add('apos-collab-marker');
    },
    sendAwareness() {
      const el = this.$refs.textarea;
      if (!this.textSync?.ready || !el) {
        return;
      }
      if (this.textSync.version < 0) {
        return;
      }
      this.collabSession.setAwareness({
        key: this.patchKey,
        anchor: el.selectionStart,
        head: el.selectionEnd,
        version: this.textSync.version,
        widgetId: this.patchKey.match(/^@([^.]+)\./)?.[1] ||
          useWidgetStore().focusedWidget || null
      });
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
      if (this.textSync) {
        this.typed(el.value, el);
      }
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
