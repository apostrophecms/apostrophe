<template>
  <div
    class="apos-assistant-summary"
    :class="`apos-assistant-summary--${kind}`"
    :data-apos-test="`assistant-summary-${kind}`"
  >
    <div class="apos-assistant-summary__line">
      <span
        v-if="kind === 'continued'"
        class="apos-assistant-summary__text"
      >
        {{ $t('aposAssistant:assistantContinuedFrom') }}
        <button
          v-if="sourceShown"
          type="button"
          class="apos-assistant-summary__source"
          data-apos-test="assistant-continued-source"
          @click="store.openChat(source.chatId)"
        >{{ sourceTitle }}</button>
        <em
          v-else
          class="apos-assistant-summary__gone"
        >{{ sourceTitle }}</em>
      </span>
      <span
        v-else
        class="apos-assistant-summary__text"
      >{{ $t('aposAssistant:assistantSummarized') }}</span>
      <button
        v-if="instructions.length"
        type="button"
        class="apos-assistant-summary__toggle"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-controls="regionId"
        data-apos-test="assistant-summary-toggle"
        @click="open = !open"
      >
        {{ $t(open ? 'aposAssistant:assistantHideSummary' : 'aposAssistant:assistantShowSummary') }}
      </button>
    </div>
    <div
      v-if="instructions.length"
      v-show="open"
      :id="regionId"
      class="apos-assistant-summary__preview"
      role="region"
      :aria-label="$t('aposAssistant:assistantSummaryRegion')"
      data-apos-test="assistant-summary-preview"
    >
      <h3 class="apos-assistant-summary__heading">
        {{ $t('aposAssistant:assistantSummaryInstructions') }}
      </h3>
      <ul class="apos-assistant-summary__items">
        <li
          v-for="(item, index) in instructions"
          :key="index"
        >
          <q>{{ item }}</q>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import {
  computed, inject, ref
} from 'vue';
import { createId } from 'apostrophe/lib/beneath.js';
import { useAssistantStore } from '../stores/assistant.js';

// A summary in the thread, read-only: the divider where the chat's current
// summary ends, or "Continued from" at the top of a continued chat. Its
// preview shows the editor's standing instructions it keeps, in their own
// words; without any, there is nothing to show
const props = defineProps({
  // 'divider' or 'continued'
  kind: {
    type: String,
    required: true
  },
  // `{ instructions }`, a list
  summary: {
    type: Object,
    default: null
  },
  // A continued chat's `continuedFrom`: `{ chatId, title }`, the title as
  // it was then
  source: {
    type: Object,
    default: null
  }
});

const $t = inject('i18n');
const store = useAssistantStore();
const open = ref(false);
const regionId = `apos-assistant-summary-${createId()}`;

const instructions = computed(() => props.summary?.instructions || []);
const sourceTitle = computed(() => props.source?.title || $t('aposAssistant:assistantUntitled'));
// A link while the earlier chat exists
const sourceShown = computed(() => Boolean(props.source &&
  store.getChat(props.source.chatId)));
</script>

<style lang="scss" scoped>
  .apos-assistant-summary {
    display: grid;
    gap: 8px;
  }

  .apos-assistant-summary__line {
    @include type-small;

    & {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--a-base-2);
      line-height: var(--a-line-tall);
    }
  }

  // A hairline each side, as the "Thought for" line
  .apos-assistant-summary--divider .apos-assistant-summary__line {
    &::before,
    &::after {
      content: '';
      flex: 1;
      border-top: 1px solid var(--a-base-8);
    }
  }

  .apos-assistant-summary--continued .apos-assistant-summary__line {
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 12px;
    padding: 0 2px;
  }

  .apos-assistant-summary__text {
    min-width: 0;
  }

  .apos-assistant-summary--divider .apos-assistant-summary__text {
    white-space: nowrap;
  }

  .apos-assistant-summary__source {
    @include apos-button-reset();
    @include type-small;

    & {
      color: var(--a-text-primary);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 1px;
    }
  }

  .apos-assistant-summary__gone {
    color: var(--a-text-primary);
  }

  .apos-assistant-summary__toggle {
    @include apos-button-reset();
    @include type-small;

    & {
      padding: 2px 4px;
      border-radius: var(--a-border-radius);
      color: var(--a-primary);
      white-space: nowrap;
    }

    &:hover {
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 1px;
    }
  }

  .apos-assistant-summary__preview {
    display: grid;
    gap: 2px;
    padding: 10px 12px;
    border: 1px solid var(--a-base-8);
    border-radius: var(--a-border-radius-large);
  }

  .apos-assistant-summary__heading {
    @include type-small;

    & {
      margin: 0;
      color: var(--a-text-primary);
      font-weight: var(--a-weight-bold);
      line-height: var(--a-line-tall);
    }
  }

  .apos-assistant-summary__items {
    @include type-small;

    & {
      display: grid;
      gap: 1px;
      margin: 0;
      padding-left: 16px;
      color: var(--a-base-1);
      line-height: var(--a-line-tall);
    }
  }
</style>
