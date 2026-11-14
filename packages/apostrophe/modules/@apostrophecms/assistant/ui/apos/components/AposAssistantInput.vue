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
const emit = defineEmits([ 'update:modelValue', 'send', 'query', 'key' ]);

const root = ref(null);
let editor = null;
let last = props.modelValue;
let queryRange = null;

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

// Another chat tab's draft, or a draft changed outside: a fresh state, so
// undo never reaches into another draft
watch(() => [ props.chatId, props.modelValue ], ([ chatId, draft ], [ oldChatId ]) => {
  if ((chatId === oldChatId) && (draft === last)) {
    return;
  }
  last = draft;
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
      Placeholder.configure({ placeholder: props.placeholder }),
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
      }
    },
    onUpdate({ editor }) {
      last = toDraft(editor.getJSON());
      emit('update:modelValue', last);
      reportQuery();
    },
    onSelectionUpdate: reportQuery,
    onBlur() {
      emit('query', null);
    }
  });
}

function reportQuery() {
  const { selection } = editor.state;
  queryRange = null;
  if (!selection.empty) {
    emit('query', null);
    return;
  }
  const { $from } = selection;
  const before = $from.parent.textBetween(
    Math.max(0, $from.parentOffset - 40),
    $from.parentOffset,
    '\n',
    node => ((node.type.name === 'hardBreak') ? '\n' : '\uFFFC')
  );
  const query = findQuery(before);
  if (query !== null) {
    queryRange = {
      from: $from.pos - query.length - 1,
      to: $from.pos
    };
  }
  emit('query', query);
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

function focus() {
  editor.commands.focus();
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
