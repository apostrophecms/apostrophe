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
        :class="{ 'apos-assistant-request__message--finished': finished }"
        data-apos-test="assistant-request-message"
      >
        <AposAssistantFiles
          v-if="sentFiles.length"
          class="apos-assistant-request__files"
          :files="sentFiles"
        />
        <AposAssistantMessage
          class="apos-assistant-request__text"
          :text="request.message"
          :mentions="request.pending ? null : (request.mentions || [])"
        />
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
        <button
          v-if="finished"
          type="button"
          class="apos-assistant-request__continue"
          :aria-label="continueLabel"
          :title="continueLabel"
          :aria-disabled="revertBlocked ? 'true' : null"
          data-apos-test="assistant-request-continue"
          @click="continueInNewChat"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2M20 16H5.2L4 17.2V4H20V16M8 9V11H12.5L10.7 12.8L12 14L16 10L12 6L10.8 7.2L12.5 9H8Z" />
          </svg>
        </button>
        <button
          v-if="finished"
          ref="revertButton"
          type="button"
          class="apos-assistant-request__revert"
          :aria-label="revertLabel"
          :title="revertLabel"
          :aria-disabled="revertBlocked ? 'true' : null"
          :aria-busy="checking ? 'true' : null"
          data-apos-test="assistant-request-revert"
          @click="startRevert"
        >
          <AposAssistantThinking v-if="checking" />
          <svg
            v-else
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M20 13.5C20 17.09 17.09 20 13.5 20H6V18H13.5C16 18 18 16 18 13.5S16 9 13.5 9H7.83L10.91 12.09L9.5 13.5L4 8L9.5 2.5L10.92 3.91L7.83 7H13.5C17.09 7 20 9.91 20 13.5Z" />
          </svg>
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
    <AposAssistantSteps
      v-if="!running && request.steps?.length"
      :request="request"
    />
    <!-- What the model wrote before an ask comes before what came of it -->
    <!-- eslint-disable vue/no-v-html -- sanitized on the server -->
    <div
      v-if="reply && (request.status === 'waiting')"
      ref="replyText"
      class="apos-assistant-request__reply"
      data-apos-test="assistant-request-reply"
      @click="onChipClick"
      v-html="reply"
    />
    <!-- eslint-enable vue/no-v-html -->
    <AposAssistantImageRounds
      v-if="request.imageAsks?.length"
      :request="request"
    />
    <!-- Below what the editor answered an image round with -->
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
    <AposAssistantNotices
      v-if="!running"
      :request="request"
    />
    <!-- eslint-disable vue/no-v-html -- sanitized on the server -->
    <div
      v-if="reply && (request.status !== 'waiting')"
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
      {{ $t(request.planCancelled ? 'apostrophe:assistantPlanCancelledNotice' : 'apostrophe:assistantStopped') }}
    </p>
    <div
      v-if="footer"
      class="apos-assistant-request__footer"
      data-apos-test="assistant-request-footer"
    >
      <button
        v-if="footer.rows.length"
        type="button"
        class="apos-assistant-request__footer-trigger"
        :aria-expanded="footerOpen ? 'true' : 'false'"
        :aria-controls="footerId"
        data-apos-test="assistant-request-footer-trigger"
        @click="footerOpen = !footerOpen"
      >
        <span>{{ footer.line }}</span>
        <AposIndicator
          class="apos-assistant-request__chevron"
          :class="{ 'apos-assistant-request__chevron--open': footerOpen }"
          icon="chevron-down-icon"
          :icon-size="14"
        />
      </button>
      <span
        v-else
        class="apos-assistant-request__footer-line"
      >{{ footer.line }}</span>
      <dl
        v-if="footer.rows.length && footerOpen"
        :id="footerId"
        class="apos-assistant-request__footer-detail"
        data-apos-test="assistant-request-footer-detail"
      >
        <div
          v-for="row in footer.rows"
          :key="row.label"
        >
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
    </div>
    <AposAssistantActivity
      v-if="suggestion"
      tone="general"
      :title="$t('apostrophe:assistantSuggestTitle')"
      :text="$t('apostrophe:assistantSuggestText')"
      :actions="[ {
        name: 'continueInNewChat',
        label: $t('apostrophe:assistantContinueInNewChat'),
        disabled: revertBlocked
      } ]"
      :dismiss-label="$t('apostrophe:assistantNotNow')"
      data-apos-test="assistant-suggestion"
      @action="onAction"
      @dismiss="store.dismissSuggestion(request.chatId, suggestion._id)"
    />
    <AposAssistantActivity
      v-if="confirmation"
      tone="warning"
      :title="$t('apostrophe:assistantRevertConfirm', { count: confirmation.requestIds.length })"
      :actions="[
        {
          name: 'cancelRevert',
          label: $t('apostrophe:cancel'),
          kind: 'quiet',
          focus: true
        },
        {
          name: 'confirmRevert',
          label: $t('apostrophe:assistantRevert'),
          kind: 'primary'
        }
      ]"
      data-apos-test="assistant-revert-confirm"
      @action="onAction"
    >
      <p
        v-for="line in confirmLines"
        :key="line.key"
        class="apos-assistant-request__line"
        data-apos-test="assistant-revert-confirm-line"
      >
        <template
          v-for="(segment, index) in line.segments"
          :key="index"
        >
          <strong v-if="segment.kind === 'count'">{{ segment.text }}</strong>
          <em v-else-if="segment.kind === 'name'">{{ segment.text }}</em>
          <span v-else>{{ segment.text }}</span>
        </template>
      </p>
    </AposAssistantActivity>
    <p
      v-if="revert?.status === 'running'"
      class="apos-assistant-request__status"
      aria-live="polite"
      data-apos-test="assistant-revert-status"
    >
      <AposAssistantThinking />
      <span class="apos-assistant-request__status-text">{{ revertStatus }}</span>
    </p>
    <AposAssistantActivity
      v-else-if="revert?.status === 'failed'"
      tone="error"
      v-bind="revertFailure"
      :actions="[ {
        name: 'retryRevert',
        label: $t('apostrophe:assistantRetry'),
        disabled: retrying
      } ]"
      data-apos-test="assistant-revert-failed"
      @action="onAction"
    />
  </div>
</template>

<script setup>
import {
  computed, inject, nextTick, onMounted, ref, watch
} from 'vue';
import { useAssistantStore } from '../stores/assistant.js';
import { createChipIcon } from '../lib/chip.js';
import { createId } from 'apostrophe/lib/beneath.js';
import AposAssistantMessage from './AposAssistantMessage.vue';
import AposAssistantFiles from './AposAssistantFiles.vue';
import AposAssistantNotices from './AposAssistantNotices.vue';
import AposAssistantImageRounds from './AposAssistantImageRounds.vue';
import { getFileUrl, isPicture } from '../lib/attachments.js';
import {
  formatNames, getConfirmLines, getRevertFailure, getRevertStatus, splitCount
} from '../lib/revert.js';

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
  },
  // The request Revert takes back from: the message's first, which a
  // retry repeats
  revertFrom: {
    type: String,
    default: null
  },
  // How many messages follow it, which Revert takes back too
  after: {
    type: Number,
    default: 0
  },
  // The revert of this message waiting on the editor's confirmation (see
  // the store's `confirmations`)
  confirmation: {
    type: Object,
    default: null
  },
  // Its revert running for the first time, or failed
  revert: {
    type: Object,
    default: null
  },
  // The suggestion to continue in a new chat shown under its reply
  // (`{ _id, sequence }`)
  suggestion: {
    type: Object,
    default: null
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
const replyText = ref(null);
const revertButton = ref(null);
const footerOpen = ref(false);
const footerId = `apos-assistant-usage-${createId()}`;

const chat = computed(() => store.getChat(props.request.chatId));
// An action of the editor's on its way
const retrying = computed(() => [ 'retry', 'send', 'retryRevert' ]
  .some(kind => store.isPending(props.request.chatId, kind)));
const answering = computed(() => store.isPending(props.request.chatId, 'answer'));
// A browser step this browser tab serves for it: the request works on, on
// the editor's screen
const browserStep = computed(() => ((chat.value?.openRequest?._id === props.request._id)
  ? store.getBrowserStep(chat.value)
  : null));
const running = computed(() => [ 'running', 'stopping' ].includes(props.request.status) ||
  Boolean(browserStep.value));
const stopping = computed(() => props.request.status === 'stopping');
// Ended, so Revert may take it back: stopped and failed ones too, since
// they may have written
const finished = computed(() => !running.value && props.revertFrom &&
  ![ 'running', 'stopping', 'waiting' ].includes(props.request.status));
// Its dry run is under way
const checking = computed(() => store.isPending(props.request.chatId, 'revertCheck',
  props.revertFrom));
// Revert waits for the chat's open request or revert to end
const revertBlocked = computed(() => Boolean(chat.value?.openRequest ||
  chat.value?.openRevert));
// Available exactly when Revert is: a new chat started during a run
// wouldn't know the work in progress
const continueLabel = computed(() => {
  if (chat.value?.openRevert) {
    return $t('apostrophe:assistantRevertBusy');
  }
  if (chat.value?.openRequest) {
    return $t('apostrophe:assistantContinueUnavailable');
  }
  return $t('apostrophe:assistantContinueFrom');
});
const revertLabel = computed(() => {
  if (chat.value?.openRevert) {
    return $t('apostrophe:assistantRevertBusy');
  }
  if (chat.value?.openRequest) {
    return $t('apostrophe:assistantRevertUnavailable');
  }
  return props.after
    ? $t('apostrophe:assistantRevertThisAndAfter', { count: props.after })
    : $t('apostrophe:assistantRevertThis');
});
// The confirmation's lines, each split into the number, the text and the
// names it keeps
const confirmLines = computed(() => {
  if (!props.confirmation) {
    return [];
  }
  return getConfirmLines(props.confirmation.documents, $t).map((line) => {
    const sentence = $t(line.key, {
      count: line.count,
      ...line.params
    });
    const segments = splitCount(sentence, line.count).map(part => ({
      text: part.text,
      kind: part.count ? 'count' : 'text'
    }));
    if (line.names) {
      segments.push({
        text: ' ',
        kind: 'text'
      });
      for (const part of formatNames(line.names, $t)) {
        segments.push({
          text: part.text,
          kind: part.name ? 'name' : 'text'
        });
      }
      segments.push({
        text: '.',
        kind: 'text'
      });
    }
    return {
      key: line.key,
      segments
    };
  });
});
const revertStatus = computed(() => (props.revert
  ? getRevertStatus(props.revert, store.revertProgress, $t)
  : null));
const revertFailure = computed(() => ((props.revert?.status === 'failed')
  ? getRevertFailure(props.revert, $t)
  : null));

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

// The files sent with the message: an image's thumbnail shown from the
// browser while this page has it, opening large; any other file
// downloading; one no longer stored as such
const sentFiles = computed(() => {
  const { chatId, unavailable = [] } = props.request;
  return (props.request.attachments || []).map((file) => {
    const picture = isPicture(file.name);
    return {
      key: file._id,
      name: file.name,
      size: file.size,
      gone: unavailable.includes(file._id),
      src: picture
        ? (store.previews[file._id] || getFileUrl(chatId, file._id, 'thumbnail'))
        : null,
      large: picture ? getFileUrl(chatId, file._id, 'preview') : null,
      href: picture ? null : getFileUrl(chatId, file._id)
    };
  });
});

// The run's last words to the editor
const reply = computed(() => {
  if (running.value) {
    return null;
  }
  return props.request.reply || null;
});

// The confirmation the request waits on, when this browser tab answers it
const confirmAsk = computed(() => {
  const { request } = props;
  if ((request.status !== 'waiting') || (store.getOwner(chat.value) !== 'here')) {
    return null;
  }
  return request.asks?.find(ask => ask.kind === 'confirm') || null;
});

// The documents the request left because someone was editing them, as one
// list of titles
const lockedTitles = computed(() => {
  const locked = props.request.locked || [];
  if (!locked.length) {
    return null;
  }
  return new Intl.ListFormat(apos.i18n.adminLocale, {
    type: 'conjunction'
  }).format(locked.map(doc => doc.title || $t('apostrophe:assistantUntitled')));
});

const activities = computed(() => {
  const { request } = props;
  const list = [];
  if (confirmAsk.value) {
    list.push({
      name: 'confirm',
      tone: 'warning',
      ...getConfirmText(confirmAsk.value.payload),
      actions: [
        {
          name: 'notNow',
          label: $t('apostrophe:assistantNotNow'),
          kind: 'quiet',
          disabled: answering.value
        },
        {
          name: 'continue',
          label: $t('apostrophe:assistantContinue'),
          kind: 'primary',
          disabled: answering.value
        }
      ]
    });
  }
  if (request.status === 'skipped') {
    list.push({
      name: 'skipped',
      tone: 'general',
      title: $t('apostrophe:assistantQuestionSkipped'),
      text: $t('apostrophe:assistantQuestionSkippedText')
    });
  }
  // Retry is a send: only on the latest request of an idle chat
  const canRetry = props.latest && (store.getOwner(chat.value) === 'none');
  if (request.status === 'failed') {
    const error = ERRORS[request.error?.name] || ERROR;
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
  if (lockedTitles.value) {
    const { length } = request.locked;
    // Named only when every document has the same named holder
    const holders = [ ...new Set(request.locked.map(doc => doc.lockedBy)) ];
    const name = (holders.length === 1) ? holders[0] : null;
    const values = {
      name,
      title: lockedTitles.value,
      titles: lockedTitles.value
    };
    const text = (length === 1)
      ? (name ? 'apostrophe:assistantLockedBy' : 'apostrophe:assistantLockedText')
      : (name ? 'apostrophe:assistantLockedManyBy' : 'apostrophe:assistantLockedManyText');
    list.push({
      name: 'locked',
      tone: 'error',
      title: (length === 1)
        ? $t('apostrophe:assistantLocked', values)
        : $t('apostrophe:assistantLockedMany', { count: length }),
      text: $t(text, values),
      actions: canRetry
        ? [ {
          name: 'retryLocked',
          label: $t('apostrophe:assistantRetry'),
          disabled: retrying.value
        } ]
        : []
    });
  }
  return list;
});

// Once the request has ended: one waiting for an answer goes on after it.
// The model and the token count open into their detail with the time the
// assistant worked; without either, the time alone. `{ line, rows }`
const footer = computed(() => {
  if (running.value || !reply.value || (props.request.status === 'waiting')) {
    return null;
  }
  const parts = [];
  const rows = [];
  const {
    provider, model, usage, workedMs
  } = props.request;
  const format = new Intl.NumberFormat(apos.i18n.adminLocale, {
    notation: 'compact',
    maximumFractionDigits: 1
  });
  if (modelDisplay && model) {
    const name = [ provider, model ].filter(Boolean).join(' - ');
    parts.push(name);
    rows.push({
      label: $t('apostrophe:assistantUsageModel'),
      value: name
    });
  }
  if ((usageDisplay === 'tokens') && usage) {
    const input = usage.inputTokens || 0;
    const output = usage.outputTokens || 0;
    parts.push($t('apostrophe:assistantTokens', {
      count: input + output,
      tokens: format.format(input + output)
    }));
    rows.push({
      label: $t('apostrophe:assistantUsageInput'),
      value: usage.cacheReadTokens
        ? $t('apostrophe:assistantUsageCached', {
          input: format.format(input),
          cached: format.format(usage.cacheReadTokens)
        })
        : format.format(input)
    }, {
      label: $t('apostrophe:assistantUsageOutput'),
      value: format.format(output)
    });
  }
  const duration = Number.isFinite(workedMs) ? formatDuration(workedMs) : null;
  if (!rows.length) {
    return duration
      ? {
        line: duration,
        rows
      }
      : null;
  }
  if (duration) {
    rows.push({
      label: $t('apostrophe:assistantUsageDuration'),
      value: duration
    });
  }
  return {
    line: parts.join(' · '),
    rows
  };
});

function formatDuration(ms) {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes
    ? $t('apostrophe:assistantDurationMinutes', {
      minutes,
      seconds
    })
    : $t('apostrophe:assistantDurationSeconds', { seconds });
}

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

// The model's own confirmation is its words; a gate's states the step and
// the documents it changes
function getConfirmText(payload) {
  const { gate } = payload;
  if (!gate) {
    return {
      title: payload.action,
      text: payload.details || null
    };
  }
  const title = (gate.count > 1)
    ? $t('apostrophe:assistantGateDocuments', {
      count: gate.count,
      type: gate.typeLabel
        ? $t(gate.typeLabel)
        : $t('apostrophe:assistantDocuments')
    })
    : $t('apostrophe:assistantGateStep', {
      label: gate.label ? $t(gate.label) : gate.tool
    });
  const names = gate.titles.map(each => each || $t('apostrophe:assistantUntitled'));
  let text = null;
  if (names.length && gate.more) {
    text = $t('apostrophe:assistantGateNamesMore', {
      titles: names.join(', '),
      count: gate.more
    });
  } else if (names.length) {
    text = new Intl.ListFormat(apos.i18n.adminLocale, {
      type: 'conjunction'
    }).format(names);
  }
  return {
    title,
    text
  };
}

function startRevert() {
  if (!revertBlocked.value && !checking.value) {
    store.startRevert(props.request.chatId, props.revertFrom);
  }
}

function continueInNewChat() {
  if (!revertBlocked.value) {
    store.continueInNewChat(props.request.chatId, props.request._id);
  }
}

async function onAction(name) {
  if (name === 'confirmRevert') {
    store.confirmRevert(props.request.chatId);
    return;
  }
  if (name === 'cancelRevert') {
    store.cancelRevert(props.request.chatId);
    await nextTick();
    revertButton.value?.focus();
    return;
  }
  if (name === 'retryRevert') {
    store.retryRevert(props.request.chatId, props.revert._id);
    return;
  }
  if (name === 'continueInNewChat') {
    continueInNewChat();
    return;
  }
  if ([ 'continue', 'notNow' ].includes(name)) {
    store.answer(props.request.chatId, confirmAsk.value.callId, {
      approved: name === 'continue'
    });
    return;
  }
  // The model is asked again for what it couldn't write, in a message of
  // the editor's own
  if (name === 'retryLocked') {
    store.send(props.request.chatId, {
      message: $t('apostrophe:assistantLockedRetryMessage', {
        titles: lockedTitles.value
      })
    });
  } else if (name === 'retry') {
    store.retry(props.request.chatId, props.request._id);
  }
}

// The server's chips get their icons once the message or the reply is in
// the page
onMounted(addChipIcons);
watch(reply, async () => {
  await nextTick();
  addChipIcons();
});

function addChipIcons() {
  for (const chip of replyText.value?.querySelectorAll('.apos-assistant-chip') || []) {
    if (!chip.querySelector('.apos-assistant-chip__icon')) {
      chip.prepend(createChipIcon(chip.dataset.kind));
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

  // Room for Continue in a new chat and Revert
  .apos-assistant-request__message--finished {
    padding-right: 75px;
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

  // The prototype's quiet Revert, where Stop sits on a running message
  .apos-assistant-request__revert {
    @include apos-button-reset();

    & {
      position: absolute;
      right: 10px;
      bottom: 10px;
      display: grid;
      place-items: center;
      width: 27px;
      height: 27px;
      border-radius: 50%;
      color: var(--a-base-3);
      opacity: 0;
      transition: opacity 200ms, background-color 200ms, color 200ms;
      pointer-events: none;
    }

    svg {
      width: 14px;
      height: 14px;
    }

    &:hover:not([aria-disabled]) {
      color: var(--a-text-primary);
      background-color: var(--a-base-10);
    }

    &:focus-visible {
      outline: 1px solid var(--a-base-7);
      outline-offset: 1px;
    }

    &[aria-disabled] {
      color: var(--a-base-6);
      cursor: default;
    }

    // Shown while its dry run is under way, hovered or not
    &[aria-busy] {
      opacity: 1;
      cursor: progress;
      pointer-events: auto;
    }
  }

  // Left of Revert, in its grey, its glyph a size down so the two weigh the
  // same
  .apos-assistant-request__continue {
    @include apos-button-reset();

    & {
      position: absolute;
      right: 40px;
      bottom: 10px;
      display: grid;
      place-items: center;
      width: 27px;
      height: 27px;
      border-radius: 50%;
      color: var(--a-base-3);
      opacity: 0;
      transition: opacity 200ms, background-color 200ms, color 200ms;
      pointer-events: none;
    }

    svg {
      width: 12px;
      height: 12px;
    }

    &:hover:not([aria-disabled]) {
      color: var(--a-text-primary);
      background-color: var(--a-base-10);
    }

    &:focus-visible {
      outline: 1px solid var(--a-base-7);
      outline-offset: 1px;
    }

    &[aria-disabled] {
      color: var(--a-base-6);
      cursor: default;
    }
  }

  .apos-assistant-request__message:hover .apos-assistant-request__stop,
  .apos-assistant-request__message:focus-within .apos-assistant-request__stop,
  .apos-assistant-request__message:hover .apos-assistant-request__continue,
  .apos-assistant-request__message:focus-within .apos-assistant-request__continue,
  .apos-assistant-request__message:hover .apos-assistant-request__revert,
  .apos-assistant-request__message:focus-within .apos-assistant-request__revert {
    opacity: 1;
    pointer-events: auto;
  }

  .apos-assistant-request__line {
    @include type-base;

    & {
      margin: 0;
      color: var(--a-base-1);
      line-height: var(--a-line-tall);
    }

    strong {
      color: var(--a-text-primary);
      font-weight: var(--a-weight-bold);
    }

    em {
      color: var(--a-text-primary);
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
  .apos-assistant-request__files {
    margin-bottom: 10px;
  }

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

  .apos-assistant-request__footer-line {
    display: inline-block;
    padding: 2px 0;
    line-height: var(--a-line-tall);
  }

  // The prototype's usage toggle
  .apos-assistant-request__footer-trigger {
    @include apos-button-reset();
    @include type-small;

    & {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 5px;
      max-width: 100%;
      padding: 2px 0;
      border-radius: var(--a-border-radius);
      color: var(--a-base-2);
      line-height: var(--a-line-tall);
      text-align: left;
      transition: color 200ms;
    }

    &:hover,
    &[aria-expanded='true'] {
      color: var(--a-text-primary);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }
  }

  .apos-assistant-request__chevron {
    flex-shrink: 0;
    color: var(--a-base-3);
    opacity: 0;
    transition: opacity 200ms ease, transform 200ms ease;
    transform: rotate(-90deg);
  }

  .apos-assistant-request__chevron--open {
    transform: rotate(0deg);
  }

  .apos-assistant-request__footer-trigger:hover .apos-assistant-request__chevron,
  .apos-assistant-request__footer-trigger:focus-visible .apos-assistant-request__chevron,
  .apos-assistant-request__footer-trigger[aria-expanded='true'] .apos-assistant-request__chevron {
    opacity: 1;
  }

  .apos-assistant-request__footer-detail {
    @include type-small;

    & {
      display: grid;
      gap: 2px;
      margin: 4px 0 0;
      padding: 8px 10px;
      border: 1px solid var(--a-base-8);
      border-radius: var(--a-border-radius-large);
      line-height: var(--a-line-tall);
    }

    div {
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }

    dt {
      color: var(--a-base-2);
    }

    dd {
      margin: 0;
      color: var(--a-text-primary);
      text-align: right;
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
