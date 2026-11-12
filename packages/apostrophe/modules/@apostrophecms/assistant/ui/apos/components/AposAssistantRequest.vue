<template>
  <div
    class="apos-assistant-request"
    data-apos-test="assistant-request"
    :data-apos-status="request.status"
  >
    <!-- Where the message sits when not pinned: the thread reads it to
      tell a pinned message apart -->
    <div
      class="apos-assistant-request__sentinel"
      aria-hidden="true"
    />
    <div
      class="apos-assistant-request__pin"
      data-apos-test="assistant-request-pin"
    >
      <div
        class="apos-assistant-request__message"
        data-apos-test="assistant-request-message"
      >
        <!-- eslint-disable vue/no-v-html -- sanitized on the server -->
        <div
          ref="text"
          class="apos-assistant-request__text"
          @click="onChipClick"
          v-html="request.messageHtml"
        />
        <!-- eslint-enable vue/no-v-html -->
        <button
          v-if="running"
          type="button"
          class="apos-assistant-request__stop"
          :aria-label="$t('apostrophe:assistantStop')"
          :title="$t('apostrophe:assistantStop')"
          :aria-disabled="stopping ? 'true' : null"
          data-apos-test="assistant-request-stop"
          @click="stop"
        >
          <AposIndicator
            icon="stop-icon"
            :icon-size="12"
          />
        </button>
      </div>
    </div>
    <p
      v-if="retried"
      class="apos-assistant-request__notice"
      data-apos-test="assistant-request-retried"
    >
      {{ $t(running ? 'apostrophe:assistantRetrying' : 'apostrophe:assistantRetried') }}
    </p>
    <p
      v-if="running"
      class="apos-assistant-request__status"
      aria-live="polite"
      data-apos-test="assistant-request-status"
    >
      <AposAssistantThinking />
      <span class="apos-assistant-request__status-shell">
        <Transition name="apos-assistant-status">
          <span
            :key="status"
            class="apos-assistant-request__status-text"
          >{{ status }}</span>
        </Transition>
      </span>
    </p>
    <AposAssistantSteps
      v-if="!running && request.steps?.length"
      :request="request"
    />
    <!-- eslint-disable vue/no-v-html -- sanitized on the server -->
    <div
      v-if="reply"
      ref="replyText"
      class="apos-assistant-request__reply"
      data-apos-test="assistant-request-reply"
      @click="onChipClick"
      v-html="reply"
    />
    <!-- eslint-enable vue/no-v-html -->
    <AposAssistantActivity
      v-for="activity in activities"
      :key="activity.name"
      v-bind="activity"
      @action="onAction"
    />
    <p
      v-if="request.status === 'stopped'"
      class="apos-assistant-request__notice"
      data-apos-test="assistant-request-stopped"
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
import {
  computed, inject, nextTick, onMounted, ref, watch
} from 'vue';
import { useAssistantStore } from '../stores/assistant.js';
import { createChipIcon } from '../lib/chip.js';

// One message and what came of it: the request that runs it, or the
// latest retry when it failed before. The message stays pinned at the top
// of the thread until the next one takes its place
const props = defineProps({
  // The request shown: the latest of the message's retries
  request: {
    type: Object,
    required: true
  },
  // Whether it retries an earlier request of the same message
  retried: {
    type: Boolean,
    default: false
  },
  // Whether it is the chat's latest request, the only one Retry may send
  // again
  latest: {
    type: Boolean,
    default: false
  }
});

// Why a request failed, in the editor's words, by the stored error's name
const ERRORS = {
  aiRetry: {
    title: 'apostrophe:assistantErrorProvider',
    text: 'apostrophe:assistantErrorProviderText'
  },
  aiContextOverflow: {
    title: 'apostrophe:assistantErrorTooLong',
    text: 'apostrophe:assistantErrorTooLongText'
  },
  aiRefusal: {
    title: 'apostrophe:assistantErrorRefusal',
    text: 'apostrophe:assistantErrorRefusalText'
  },
  interrupted: {
    title: 'apostrophe:assistantErrorInterrupted',
    text: 'apostrophe:assistantErrorInterruptedText'
  }
};
const ERROR = {
  title: 'apostrophe:assistantError',
  text: 'apostrophe:assistantErrorText'
};

const $t = inject('i18n');
const store = useAssistantStore();
const { usageDisplay, modelDisplay } = apos.modules['@apostrophecms/assistant'];
const retrying = ref(false);
const text = ref(null);
const replyText = ref(null);

const chat = computed(() => store.getChat(props.request.chatId));
// A browser step this browser tab serves for it: the request works on, on
// the editor's screen
const browserStep = computed(() => ((chat.value?.openRequest?._id === props.request._id)
  ? store.getBrowserStep(chat.value)
  : null));
const running = computed(() => [ 'running', 'stopping' ].includes(props.request.status) ||
  Boolean(browserStep.value));
const stopping = computed(() => props.request.status === 'stopping');

// The latest step's label replaces the one before it
const status = computed(() => {
  if (stopping.value) {
    return $t('apostrophe:assistantStopping');
  }
  if (browserStep.value) {
    return getBrowserStatus(browserStep.value);
  }
  const progress = store.progress[props.request._id];
  if (progress?.retrying) {
    return $t('apostrophe:assistantStillRetrying');
  }
  return progress?.label
    ? `${$t(progress.label)}...`
    : $t('apostrophe:assistantThinking');
});

// The run's last words to the editor
const reply = computed(() => {
  if (running.value) {
    return null;
  }
  return (props.request.messages || [])
    .findLast(message => (message.role === 'assistant') && message.html)?.html || null;
});

const activities = computed(() => {
  const { request } = props;
  const list = [];
  if (request.status === 'failed') {
    const error = ERRORS[request.error?.name] || ERROR;
    // Retry is a send: only on the latest request of an idle chat
    const canRetry = props.latest && (store.getOwner(chat.value) === 'none');
    list.push({
      name: 'failed',
      tone: 'error',
      title: $t(error.title),
      text: $t(error.text),
      actions: canRetry
        ? [ {
          name: 'retry',
          label: $t('apostrophe:assistantRetry'),
          disabled: retrying.value
        } ]
        : []
    });
  }
  if (request.finishReason === 'length') {
    list.push({
      name: 'length',
      tone: 'warning',
      title: $t('apostrophe:assistantCutOff'),
      text: $t('apostrophe:assistantCutOffText')
    });
  }
  if (request.finishReason === 'maxSteps') {
    list.push({
      name: 'maxSteps',
      tone: 'warning',
      title: $t('apostrophe:assistantOutOfSteps'),
      text: $t('apostrophe:assistantOutOfStepsText')
    });
  }
  const locked = request.locked || [];
  if (locked.length) {
    const titles = locked.map(doc => doc.title || $t('apostrophe:assistantUntitled'));
    list.push((titles.length === 1)
      ? {
        name: 'locked',
        tone: 'error',
        title: $t('apostrophe:assistantLocked', { title: titles[0] }),
        text: $t('apostrophe:assistantLockedText')
      }
      : {
        name: 'locked',
        tone: 'error',
        title: $t('apostrophe:assistantLockedMany', { count: titles.length }),
        text: $t('apostrophe:assistantLockedManyText', {
          titles: new Intl.ListFormat(apos.i18n.adminLocale, {
            type: 'conjunction'
          }).format(titles)
        })
      });
  }
  return list;
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

function stop() {
  if (!stopping.value) {
    store.stop(props.request.chatId);
  }
}

// What a browser step waits on, or the step itself
function getBrowserStatus(step) {
  const { holder } = step;
  if ((step.state === 'hold') && holder.requestId) {
    return $t('apostrophe:assistantWaitingChat', {
      title: holder.title || $t('apostrophe:assistantNewChat')
    });
  }
  if (step.state === 'hold') {
    return $t(holder.modal ? 'apostrophe:assistantWaitingModal' : 'apostrophe:assistantWaitingUnsaved');
  }
  if ((step.state === 'released') && step.status) {
    return $t(step.status);
  }
  return step.label
    ? `${$t(step.label)}...`
    : $t('apostrophe:assistantThinking');
}

async function onAction(name) {
  if ((name !== 'retry') || retrying.value) {
    return;
  }
  retrying.value = true;
  try {
    await store.retry(props.request.chatId, props.request._id);
  } finally {
    retrying.value = false;
  }
}

// The server's chips get their icons once the message or the reply is in
// the page
onMounted(addChipIcons);
watch([ () => props.request.messageHtml, reply ], async () => {
  await nextTick();
  addChipIcons();
});

function addChipIcons() {
  for (const container of [ text.value, replyText.value ]) {
    for (const chip of container?.querySelectorAll('.apos-assistant-chip') || []) {
      if (!chip.querySelector('.apos-assistant-chip__icon')) {
        chip.prepend(createChipIcon(chip.dataset.kind));
      }
    }
  }
}

// A chip of a document without a page opens its editor; one with a page is
// a link to it
function onChipClick(event) {
  const chip = event.target.closest('button.apos-assistant-chip');
  if (chip) {
    apos.doc.edit({
      type: chip.dataset.type,
      _id: chip.dataset.id
    });
  }
}
</script>

<style lang="scss" scoped>
  .apos-assistant-request {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  .apos-assistant-request__sentinel {
    visibility: hidden;
    flex: 0 0 auto;
    height: 1px;
    margin-bottom: -10px;
    pointer-events: none;
  }

  // Pinned to the top of the thread until the next message's pin pushes
  // it out. Once pinned it masks the thread's padding above it and a few
  // pixels below, so the text scrolling under it never shows around it
  .apos-assistant-request__pin {
    z-index: $z-index-default;
    position: sticky;
    top: 0;
    margin-inline: -20px;
    padding: 8px 20px 0;
    background-color: var(--a-background-primary);
    isolation: isolate;

    &[data-stuck='true'] {
      box-shadow: 0 -56px 0 0 var(--a-background-primary);
    }

    &[data-stuck='true']::before,
    &[data-stuck='true']::after {
      content: '';
      position: absolute;
      right: 0;
      left: 0;
      background-color: var(--a-background-primary);
      pointer-events: none;
    }

    &[data-stuck='true']::before {
      bottom: 100%;
      height: 56px;
    }

    &[data-stuck='true']::after {
      top: 100%;
      height: 4px;
    }
  }

  .apos-assistant-request__message {
    @include type-label;

    & {
      position: relative;
      min-height: 49px;
      box-sizing: border-box;
      padding: 15px 45px 15px 10px;
      border: 1px solid color-mix(in srgb, var(--a-primary) 25%, transparent);
      border-radius: var(--a-border-radius-large);
      background-color: var(--a-background-primary);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
  }

  // Shown on hover and keyboard focus, as the prototype's Stop on a
  // running message
  .apos-assistant-request__stop {
    @include apos-button-reset();

    & {
      position: absolute;
      right: 12px;
      bottom: 12px;
      display: grid;
      place-items: center;
      width: 23px;
      height: 23px;
      border-radius: 50%;
      color: var(--a-white);
      background-color: var(--a-primary);
      opacity: 0;
      transition: opacity 200ms, background-color 200ms;
      pointer-events: none;
    }

    &:hover:not([aria-disabled]) {
      background-color: var(--a-primary-dark-10);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }

    &[aria-disabled] {
      color: var(--a-base-5);
      background-color: var(--a-base-9);
      cursor: default;
    }
  }

  .apos-assistant-request__message:hover .apos-assistant-request__stop,
  .apos-assistant-request__message:focus-within .apos-assistant-request__stop {
    opacity: 1;
    pointer-events: auto;
  }

  .apos-assistant-request__status {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    margin: 0;
    padding: 4px 2px 0;
  }

  .apos-assistant-request__status-shell {
    position: relative;
    overflow: hidden;
    flex: 1 1 0;
    min-width: 0;
  }

  .apos-assistant-request__status-text {
    @include type-label;

    & {
      display: block;
      overflow: hidden;
      min-width: 0;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }

  .apos-assistant-status-enter-active,
  .apos-assistant-status-leave-active {
    transition: opacity 500ms ease-out;
  }

  .apos-assistant-status-leave-active {
    position: absolute;
    inset: 0;
  }

  .apos-assistant-status-enter-from,
  .apos-assistant-status-leave-to {
    opacity: 0;
  }

  // Markdown, the message's and the reply's
  .apos-assistant-request__text,
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
      color: var(--a-base-2);
    }
  }

  /* stylelint-disable-next-line media-feature-name-allowed-list */
  @media (prefers-reduced-motion: reduce) {
    .apos-assistant-status-enter-active,
    .apos-assistant-status-leave-active {
      transition: none;
    }
  }
</style>
