<template>
  <div
    ref="root"
    class="apos-assistant-input"
  />
</template>

<script setup>
// The composer's editing area: text and chips, no formatting. Core's tiptap
// editor, not the Vue one, whose reactive copy of the state goes stale when
// a chat tab switch puts in a fresh state
import {
  onBeforeUnmount, onMounted, ref, watch
} from 'vue';
import { Editor, Node } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import HardBreak from '@tiptap/extension-hard-break';
import History from '@tiptap/extension-history';
import Placeholder from '@tiptap/extension-placeholder';
import {
  parseDraft, mentionToken, findQuery
} from '../lib/draft.js';
import { createChip, readChip } from '../lib/chip.js';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  chatId: {
    type: String,
    required: true
  },
  placeholder: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  aria: {
    type: Object,
    default: () => ({})
  }
});
const emit = defineEmits([ 'update:modelValue', 'send', 'query', 'key', 'files' ]);

const root = ref(null);
let editor = null;
let last = props.modelValue;
let queryRange = null;
// The `@` of the open search, across spaces; the `@` whose search Escape
// ended, so its letters don't open it again. Both moved along with edits
let searchAt = null;
let endedAt = null;
const MAX_QUERY = 100;
const LEAF = '\uFFFC';

const Mention = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addAttributes() {
    return {
      id: { default: null },
      title: { default: '' },
      kind: { default: 'page' }
    };
  },
  parseHTML() {
    return [ {
      tag: 'span[data-apos-mention]',
      getAttrs: readChip
    } ];
  },
  renderHTML({ node }) {
    return [ 'span', {
      'data-apos-mention': '',
      'data-id': node.attrs.id,
      'data-kind': node.attrs.kind,
      'data-title': node.attrs.title
    }, node.attrs.title ];
  },
  renderText({ node }) {
    return `@${node.attrs.title}`;
  },
  addNodeView() {
    return ({
      node, getPos, editor
    }) => ({
      dom: createChip(node.attrs, {
        onRemove() {
          const from = getPos();
          editor.chain().focus().deleteRange({
            from,
            to: from + node.nodeSize
          }).run();
        }
      }),
      ignoreMutation: () => true,
      stopEvent: event => Boolean(event.target.closest?.('.apos-assistant-chip__remove'))
    });
  }
});

onMounted(() => {
  editor = createEditor();
  setAria(props.aria);
});
onBeforeUnmount(() => editor.destroy());

watch(() => props.aria, setAria);
// The placeholder is drawn from the state: a new one needs a redraw
watch(() => props.placeholder, () => editor?.view.dispatch(editor.state.tr));

// Another chat tab's draft, or a draft changed outside: a fresh state, so
// undo never reaches into another draft
watch(() => [ props.chatId, props.modelValue ], ([ chatId, draft ], [ oldChatId ]) => {
  if ((chatId === oldChatId) && (draft === last)) {
    return;
  }
  last = draft;
  searchAt = null;
  endedAt = null;
  editor.view.updateState(EditorState.create({
    doc: editor.schema.nodeFromJSON(toDoc(draft)),
    plugins: editor.state.plugins
  }));
});

function setAria(aria) {
  const dom = editor.view.dom;
  for (const [ name, value ] of Object.entries(aria)) {
    if (value == null) {
      dom.removeAttribute(name);
    } else {
      dom.setAttribute(name, value);
    }
  }
}

function createEditor() {
  return new Editor({
    element: root.value,
    extensions: [
      Document,
      Paragraph,
      Text,
      HardBreak,
      History,
      // Read on every redraw, so a new placeholder shows at once
      Placeholder.configure({ placeholder: () => props.placeholder }),
      Mention
    ],
    content: toDoc(props.modelValue),
    editorProps: {
      attributes: {
        class: 'apos-assistant-input__area',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': props.label,
        'data-apos-test': 'assistant-input'
      },
      handleKeyDown(view, event) {
        emit('key', event);
        if (event.defaultPrevented) {
          return true;
        }
        // Shift+Enter falls through to the hard break
        if ((event.key === 'Enter') && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          emit('send');
          return true;
        }
        return false;
      },
      // Files go to the composer's attachments, never into the text
      handlePaste(view, event) {
        const files = [ ...(event.clipboardData?.files || []) ];
        if (!files.length) {
          return false;
        }
        emit('files', files);
        return true;
      },
      // The window takes dropped files (AposAssistant.vue)
      handleDrop(view, event) {
        return Boolean(event.dataTransfer?.types?.includes('Files'));
      },
      handleDOMEvents: {
        // A click in the editing area ends the search, the caret moved or
        // not; one right after a single word typed after `@` opens it again
        mousedown() {
          searchAt = null;
          reportQuery();
          return false;
        }
      }
    },
    onTransaction({ transaction }) {
      searchAt = mapAt(searchAt, transaction);
      endedAt = mapAt(endedAt, transaction);
    },
    onUpdate({ editor }) {
      last = toDraft(editor.getJSON());
      emit('update:modelValue', last);
      reportQuery();
    },
    onSelectionUpdate: reportQuery,
    onBlur() {
      searchAt = null;
      emit('query', null);
    }
  });
}

// Where the `@` at `at` is after the change, or `null` once it is gone
function mapAt(at, transaction) {
  if (at === null) {
    return null;
  }
  const { doc } = transaction;
  const mapped = transaction.mapping.map(at, 1);
  const end = Math.min(mapped + 1, doc.content.size);
  return (doc.textBetween(mapped, end) === '@') ? mapped : null;
}

function reportQuery() {
  const query = readQuery();
  queryRange = (query === null)
    ? null
    : {
      from: searchAt,
      to: searchAt + query.length + 1
    };
  emit('query', query);
}

// A search opens at an `@` typed at the start or after a space, and reads
// what follows it up to the caret, spaces too. It ends when the caret leaves
// it, at a line break or a chip, past the longest query, or with a space
// right after the `@`
function readQuery() {
  const { selection, doc } = editor.state;
  if (!selection.empty) {
    searchAt = null;
    return null;
  }
  const { $from } = selection;
  const start = $from.start();
  if ((searchAt !== null) && (searchAt >= start) && (searchAt < $from.pos)) {
    const query = textBetween(searchAt + 1, $from.pos);
    if (!/^\s|[\n\uFFFC]/.test(query) && (query.length <= MAX_QUERY)) {
      return query;
    }
  }
  searchAt = null;
  const query = findQuery(
    textBetween(Math.max(start, $from.pos - MAX_QUERY - 1), $from.pos)
  );
  const at = (query === null) ? null : $from.pos - query.length - 1;
  if ((at === null) || (at === endedAt)) {
    return null;
  }
  searchAt = at;
  return query;

  function textBetween(from, to) {
    return doc.textBetween(from, to, '\n', node => (
      (node.type.name === 'hardBreak') ? '\n' : LEAF
    ));
  }
}

// Ends the search; its `@` doesn't open it again
function endQuery() {
  endedAt = searchAt;
  searchAt = null;
  queryRange = null;
  emit('query', null);
}

function insertMention(mention) {
  if (!queryRange) {
    return;
  }
  editor.chain().focus().insertContentAt(queryRange, [
    {
      type: 'mention',
      attrs: mention
    },
    {
      type: 'text',
      text: ' '
    }
  ]).run();
}

// With `at`, the caret goes that many characters into the draft's first
// line, or to its end with 'end'
function focus(at = null) {
  if ((at === null) || (at === 'end')) {
    editor.commands.focus(at);
    return;
  }
  editor.commands.focus(Math.min(at + 1, editor.state.doc.content.size - 1));
}

function toDoc(draft) {
  const content = [];
  for (const part of parseDraft(draft)) {
    if (part.mention) {
      content.push({
        type: 'mention',
        attrs: part.mention
      });
      continue;
    }
    part.text.split('\n').forEach((line, i) => {
      if (i) {
        content.push({ type: 'hardBreak' });
      }
      if (line) {
        content.push({
          type: 'text',
          text: line
        });
      }
    });
  }
  return {
    type: 'doc',
    content: [ {
      type: 'paragraph',
      content
    } ]
  };
}

// Pasted paragraphs are lines
function toDraft(json) {
  return (json.content || []).map(paragraph => (paragraph.content || []).map(node => {
    if (node.type === 'mention') {
      return mentionToken(node.attrs);
    }
    if (node.type === 'hardBreak') {
      return '\n';
    }
    return node.text || '';
  }).join('')).join('\n');
}

defineExpose({
  insertMention,
  endQuery,
  focus
});
</script>

<style lang="scss" scoped>
  .apos-assistant-input :deep(.apos-assistant-input__area) {
    @include type-label;

    & {
      overflow-y: auto;
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      min-height: 40px;
      max-height: 160px;
      padding: 4px 7px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
      outline: none;
    }

    p {
      margin: 0;
    }

    .is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      float: left;
      height: 0;
      color: var(--a-base-4);
      pointer-events: none;
    }
  }
</style>
