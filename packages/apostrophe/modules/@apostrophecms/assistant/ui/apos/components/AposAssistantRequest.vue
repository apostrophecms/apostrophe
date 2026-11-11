<template>
  <div
    class="apos-assistant-request"
    data-apos-test="assistant-request"
    :data-apos-status="request.status"
  >
    <p
      class="apos-assistant-request__message"
      data-apos-test="assistant-request-message"
    >
      {{ request.message }}
    </p>
    <p
      v-if="running"
      class="apos-assistant-request__status"
      aria-live="polite"
      data-apos-test="assistant-request-status"
    >
      <AposAssistantThinking />
      <span class="apos-assistant-request__status-text">{{ status }}</span>
    </p>
    <!-- eslint-disable vue/no-v-html -- sanitized on the server -->
    <div
      v-if="reply"
      class="apos-assistant-request__reply"
      data-apos-test="assistant-request-reply"
      v-html="reply"
    />
    <!-- eslint-enable vue/no-v-html -->
    <p
      v-if="request.status === 'stopped'"
      class="apos-assistant-request__notice"
    >
      {{ $t('apostrophe:assistantStopped') }}
    </p>
    <p
      v-if="footer"
      class="apos-assistant-request__footer"
      data-apos-test="assistant-request-footer"
    >
      {{ footer }}
    </p>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue';
import { useAssistantStore } from '../stores/assistant.js';

// One request: the editor's message, then the run's progress while it runs,
// then the reply and what it used
const props = defineProps({
  request: {
    type: Object,
    required: true
  }
});

const $t = inject('i18n');
const store = useAssistantStore();
const { usageDisplay, modelDisplay } = apos.modules['@apostrophecms/assistant'];

const running = computed(() => [ 'running', 'stopping' ].includes(props.request.status));

// The latest step's label replaces the one before it
const status = computed(() => {
  const label = store.progress[props.request._id]?.label;
  return label ? `${$t(label)}...` : $t('apostrophe:assistantThinking');
});

// The run's last words to the editor
const reply = computed(() => {
  if (running.value) {
    return null;
  }
  return (props.request.messages || [])
    .findLast(message => (message.role === 'assistant') && message.html)?.html || null;
});

const footer = computed(() => {
  if (running.value || !reply.value) {
    return null;
  }
  const parts = [];
  const {
    provider, model, usage
  } = props.request;
  if (modelDisplay && model) {
    parts.push([ provider, model ].filter(Boolean).join(' - '));
  }
  if ((usageDisplay === 'tokens') && usage) {
    const tokens = (usage.inputTokens || 0) + (usage.outputTokens || 0);
    const format = new Intl.NumberFormat(apos.i18n.adminLocale, {
      notation: 'compact',
      maximumFractionDigits: 1
    });
    parts.push($t('apostrophe:assistantTokens', {
      count: tokens,
      tokens: format.format(tokens)
    }));
  }
  return parts.join(' · ') || null;
});
</script>

<style lang="scss" scoped>
  .apos-assistant-request {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .apos-assistant-request__message {
    @include type-label;

    & {
      margin: 0;
      padding: 9px 10px;
      border: 1px solid color-mix(in srgb, var(--a-primary) 25%, transparent);
      border-radius: var(--a-border-radius-large);
      background-color: var(--a-background-primary);
      line-height: 1.45;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  }

  .apos-assistant-request__status {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    margin: 0;
    padding: 4px 2px 0;
  }

  .apos-assistant-request__status-text {
    @include type-label;

    & {
      overflow: hidden;
      min-width: 0;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }

  .apos-assistant-request__reply {
    @include type-label;

    & {
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    :deep(p),
    :deep(ul),
    :deep(ol),
    :deep(blockquote),
    :deep(pre),
    :deep(table) {
      margin: 0 0 $spacing-base;
    }

    :deep(> *:last-child) {
      margin-bottom: 0;
    }

    :deep(h1),
    :deep(h2),
    :deep(h3),
    :deep(h4),
    :deep(h5),
    :deep(h6) {
      @include type-label;

      & {
        margin: $spacing-base 0 $spacing-half;
        font-weight: var(--a-weight-bold);
      }
    }

    :deep(ul),
    :deep(ol) {
      padding-inline-start: $spacing-double;
    }

    :deep(li) {
      margin-bottom: $spacing-half;
    }

    :deep(code) {
      padding: 2px 4px;
      border-radius: var(--a-border-radius);
      background-color: var(--a-base-9);
    }

    :deep(pre) {
      overflow-x: auto;
      padding: $spacing-base;
      border-radius: var(--a-border-radius);
      background-color: var(--a-base-9);
    }

    :deep(pre code) {
      padding: 0;
      background-color: transparent;
    }

    :deep(blockquote) {
      padding-inline-start: $spacing-base;
      border-inline-start: 2px solid var(--a-base-7);
      color: var(--a-base-1);
    }

    :deep(table) {
      display: block;
      overflow-x: auto;
      border-collapse: collapse;
    }

    :deep(th),
    :deep(td) {
      padding: $spacing-half;
      border: 1px solid var(--a-base-8);
      text-align: start;
    }

    :deep(a) {
      color: var(--a-primary);
    }
  }

  .apos-assistant-request__notice {
    @include type-label;

    & {
      margin: 0;
      padding: 4px 2px 0;
      color: var(--a-base-1);
      font-style: italic;
    }
  }

  .apos-assistant-request__footer {
    @include type-small;

    & {
      margin: -4px 0 0;
      padding: 0 2px;
      color: var(--a-base-4);
    }
  }
</style>
