<template>
  <dl
    v-for="ask in request.questionAsks"
    :key="ask.callId"
    class="apos-assistant-questions"
    data-apos-test="assistant-questions"
  >
    <div
      v-for="(entry, index) in ask.questions"
      :key="index"
      class="apos-assistant-questions__item"
      data-apos-test="assistant-questions-item"
    >
      <dt class="apos-assistant-questions__question">
        {{ entry.question }}
      </dt>
      <dd
        v-if="entry.answer"
        class="apos-assistant-questions__answer"
        data-apos-test="assistant-questions-answer"
      >
        {{ entry.answer }}
      </dd>
      <dd
        v-else
        class="apos-assistant-questions__answer apos-assistant-questions__answer--left"
        data-apos-test="assistant-questions-answer"
      >
        {{ $t('apostrophe:assistantQuestionLeft') }}
      </dd>
    </div>
  </dl>
</template>

<script setup>
import { inject } from 'vue';

// What stays of a request's answered questions: each question with the
// answer given, read only
defineProps({
  // `questionAsks`: `{ callId, questions }`
  request: {
    type: Object,
    required: true
  }
});

const $t = inject('i18n');
</script>

<style lang="scss" scoped>
  // The question is the assistant's words, there for context; the answer
  // is the editor's, in their message's style, tabbed in under it
  .apos-assistant-questions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 0;
    // The message's left padding, so their text lines up
    padding: 12px 10px;
    border: 1px solid color-mix(in srgb, var(--a-primary) 25%, transparent);
    border-radius: var(--a-border-radius-large);
    background-color: var(--a-background-primary);
  }

  .apos-assistant-questions__item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .apos-assistant-questions__question {
    @include type-label;

    & {
      color: var(--a-base-2);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
  }

  .apos-assistant-questions__answer {
    @include type-label;

    & {
      margin: 0 0 0 14px;
      color: var(--a-text-primary);
      line-height: 1.45;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  }

  .apos-assistant-questions__answer--left {
    color: var(--a-base-3);
  }
</style>
