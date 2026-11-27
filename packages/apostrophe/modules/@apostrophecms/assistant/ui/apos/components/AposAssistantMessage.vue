<template>
  <div
    class="apos-assistant-message"
    data-apos-test="assistant-message"
  >
    <template
      v-for="(block, index) in blocks"
      :key="index"
    >
      <pre
        v-if="block.type === 'code'"
        class="apos-assistant-message__code"
      ><code>{{ block.text }}</code></pre>
      <component
        :is="(block.type === 'quote') ? 'blockquote' : 'p'"
        v-else
        class="apos-assistant-message__text"
        :class="{ 'apos-assistant-message__text--quote': block.type === 'quote' }"
      >
        <template
          v-for="(part, partIndex) in block.parts"
          :key="partIndex"
        >
          <AposAssistantChip
            v-if="part.mention"
            :title="part.mention.title"
            :kind="part.mention.kind"
            :href="part.checked?.url || null"
            :button="Boolean(part.checked && !part.checked.url)"
            @action="edit(part.checked)"
          />
          <span
            v-else
            v-text="part.text"
          />
        </template>
      </component>
    </template>
  </div>
</template>

<script setup>
// An editor's message, as typed: text with its line breaks, chips for its
// mentions, code blocks and quotes (`ui/apos/universal/message.js`). Never
// HTML, so nothing in it needs sanitizing. A message still on its way shows
// the same, its chips acting once the server's checked `mentions` are in: a
// document with a page links to it, any other opens its editor
import { computed } from 'vue';
import {
  splitBlocks, parseMentions, getPlainMessage
} from 'Modules/@apostrophecms/assistant/universal/message.js';
import AposAssistantChip from './AposAssistantChip.vue';

const props = defineProps({
  text: {
    type: String,
    required: true
  },
  // The documents the server checked, `null` until it has
  mentions: {
    type: Array,
    default: null
  }
});

const blocks = computed(() => {
  const checked = new Map((props.mentions || [])
    .map(mention => [ mention._id, mention ]));
  return splitBlocks(props.text).map(block => ((block.type === 'code')
    ? {
      type: 'code',
      text: getPlainMessage(block.text)
    }
    : {
      type: block.type,
      parts: parseMentions(block.text).map(part => (part.mention
        ? {
          mention: part.mention,
          checked: checked.get(part.mention.id) || null
        }
        : part))
    }));
});

function edit(mention) {
  apos.doc.edit({
    type: mention.type,
    _id: mention._id
  });
}
</script>

<style lang="scss" scoped>
  .apos-assistant-message__text,
  .apos-assistant-message__code {
    margin: 0 0 $spacing-base;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .apos-assistant-message__text {
    white-space: pre-wrap;
  }

  .apos-assistant-message__text--quote {
    padding-inline-start: $spacing-base;
    border-inline-start: 2px solid var(--a-base-7);
    color: var(--a-base-1);
  }

  .apos-assistant-message__code {
    overflow-x: auto;
    padding: $spacing-base;
    border-radius: var(--a-border-radius);
    background-color: var(--a-base-9);
  }
</style>
