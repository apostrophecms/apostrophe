<template>
  <form
    class="apos-assistant-composer"
    data-apos-test="assistant-composer"
    @submit.prevent="send"
    @keyup.esc="onEscapeUp"
  >
    <AposAssistantDock
      v-if="dock"
      v-bind="dock"
      @action="onDockAction"
    />
    <AposAssistantAsk
      v-else-if="question"
      :key="question.callId"
      :chat-id="chatId"
      :ask="question"
    />
    <AposAssistantPlan
      v-else-if="plan"
      :request="plan.request"
      :failed="plan.failed"
      :cancellable="plan.cancellable"
      @cancel="cancelPlan"
    />
    <div class="apos-assistant-composer__shell">
      <div
        v-if="listOpen"
        class="apos-assistant-mention"
      >
        <div
          v-if="results.length"
          :id="listId"
          class="apos-assistant-mention__list"
          role="listbox"
          :aria-label="$t('apostrophe:assistantMentionList')"
          data-apos-test="assistant-mention-list"
        >
          <div
            v-for="(item, i) in results"
            :id="`${listId}-${i}`"
            :key="item._id"
            class="apos-assistant-mention__option"
            :class="{ 'apos-assistant-mention__option--active': i === active }"
            role="option"
            :aria-selected="i === active ? 'true' : 'false'"
            data-apos-test="assistant-mention-option"
            @mousedown.prevent
            @mousemove="active = i"
            @click="pick(item)"
          >
            <span class="apos-assistant-mention__title">{{ item.title }}</span>
            <span class="apos-assistant-mention__hint">{{ $t(item.label) }}</span>
          </div>
        </div>
        <p
          v-else
          class="apos-assistant-mention__empty"
          role="status"
          data-apos-test="assistant-mention-empty"
        >
          {{ $t('apostrophe:assistantNoResults') }}
        </p>
      </div>
      <AposAssistantSelection @empty="input.focus()" />
      <AposAssistantInput
        ref="input"
        :model-value="draft"
        :chat-id="chatId"
        :placeholder="$t('apostrophe:assistantPlaceholder')"
        :label="$t('apostrophe:assistantMessage')"
        :aria="aria"
        @update:model-value="onInput"
        @send="send"
        @query="onQuery"
        @key="onKey"
      />
      <div class="apos-assistant-composer__actions">
        <button
          v-if="canSelect"
          type="button"
          class="apos-assistant-composer__tool"
          :aria-label="$t('apostrophe:assistantSelectOnPage')"
          :title="$t('apostrophe:assistantSelectOnPage')"
          data-apos-test="assistant-select-on-page"
          @click="selectOnPage"
        >
          <svg
            viewBox="0 0 18 18"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="nonzero"
              d="M1,0 L2,0 L2,2 L0,2 L0,1 C0,0.44771525 0.44771525,0 1,0 M17,0 C17.5522847,0 18,0.44771525 18,1 L18,2 L16,2 L16,0 L17,0 M12,2 L12,0 L14,0 L14,2 L12,2 M8,2 L8,0 L10,0 L10,2 L8,2 M4,2 L4,0 L6,0 L6,2 L4,2 M4,18 L4,16 L6,16 L6,18 L4,18 M1,18 C0.44771525,18 0,17.5522847 0,17 L0,16 L2,16 L2,18 L1,18 M0,12 L2,12 L2,14 L0,14 L0,12 M0,8 L2,8 L2,10 L0,10 L0,8 M0,4 L2,4 L2,6 L0,6 L0,4 M18,8 L18,9.92037447 L11.2394414,9.92037447 L18,16.7535528 L16.554249,18 L9.89996565,11.2742385 L9.89996565,18 L8,18 L8,8 L18,8 Z M18,4 L18,6 L16,6 L16,4 L18,4 Z"
            />
          </svg>
        </button>
        <!-- One button, Send or Stop, so focus stays on it when it turns -->
        <button
          :type="stopShown ? 'button' : 'submit'"
          class="apos-assistant-composer__send"
          :disabled="!stopShown && !canSend"
          :aria-disabled="(stopShown && stopping) ? 'true' : null"
          :aria-label="$t(stopShown ? 'apostrophe:assistantStop' : 'apostrophe:assistantSend')"
          :title="stopShown ? $t('apostrophe:assistantStop') : null"
          :data-apos-test="stopShown ? 'assistant-stop' : 'assistant-send'"
          @click="stopShown && stop()"
        >
          <AposIndicator
            :icon="stopShown ? 'stop-icon' : 'arrow-up-icon'"
            :icon-size="stopShown ? 12 : 14"
          />
        </button>
      </div>
    </div>
  </form>
</template>

<script setup>
import {
  computed, onBeforeUnmount, onMounted, ref
} from 'vue';
import { createId } from 'apostrophe/lib/beneath.js';
import { useAssistantStore } from '../stores/assistant.js';
import AposAssistantInput from './AposAssistantInput.vue';
import AposAssistantSelection from './AposAssistantSelection.vue';

// The composer of the active chat tab. It never takes focus on its own:
// only the editor's click or Tab puts it there
const props = defineProps({
  chatId: {
    type: String,
    required: true
  }
});

const store = useAssistantStore();
const input = ref(null);
const sending = ref(false);
const listId = `apos-assistant-mention-${createId()}`;
const query = ref(null);
const closed = ref(false);
const active = ref(0);
let escaped = false;
// The latest search's results; `null` until the first one answers
const results = ref(null);
let searches = 0;
let searchTimer = null;
const listOpen = computed(() => (query.value !== null) && !closed.value &&
  (results.value !== null));
const aria = computed(() => ({
  'aria-autocomplete': 'list',
  'aria-controls': (listOpen.value && results.value.length) ? listId : null,
  'aria-activedescendant': (listOpen.value && results.value.length)
    ? `${listId}-${active.value}`
    : null
}));

// Edit mode, read again whenever the page refreshes, as switching it does
const editMode = ref(Boolean(window.apos.adminBar?.editMode));
const canSelect = computed(() => !editMode.value &&
  Boolean(window.apos.adminBar?.contextId && window.apos.adminBar.setEditMode));

const draft = computed(() => store.drafts[props.chatId] || '');
const chat = computed(() => store.getChat(props.chatId));
const owner = computed(() => store.getOwner(chat.value));
// A revert running or waiting on its confirmation is about to rewind the
// thread: the composer takes a draft, Send waits
const canSend = computed(() => !sending.value &&
  !!draft.value.trim() &&
  (owner.value === 'none') &&
  !chat.value?.openRevert &&
  !store.confirmations[props.chatId]);
// While the chat runs, an empty composer stops it, in any browser tab, and
// so it does while a browser step works on this browser tab's screen
const running = computed(() => [ 'running', 'stopping' ].includes(chat.value?.openRequest?.status) ||
  Boolean(store.getBrowserStep(chat.value)));
const stopping = computed(() => chat.value?.openRequest?.status === 'stopping');
const stopShown = computed(() => running.value && !draft.value.trim());

// A refused send says why; a chat running in another browser tab says it
// can only be followed here, and one waiting there offers to continue here
const dock = computed(() => {
  const refusal = store.refusals[props.chatId];
  if (refusal) {
    return {
      tone: 'error',
      ...refusal
    };
  }
  const open = chat.value?.openRequest;
  if ((owner.value === 'elsewhere') && [ 'running', 'stopping' ].includes(open.status)) {
    return {
      tone: 'general',
      title: 'apostrophe:assistantOtherTab',
      text: 'apostrophe:assistantOtherTabText'
    };
  }
  if ((owner.value === 'elsewhere') && (open.status === 'waiting')) {
    return {
      tone: 'warning',
      title: 'apostrophe:assistantWaitingOtherTab',
      text: 'apostrophe:assistantWaitingOtherTabText',
      action: 'apostrophe:assistantContinueHere'
    };
  }
  return null;
});

const latest = computed(() => store.requests[props.chatId]?.at(-1) || null);
// The questions the chat's request waits on, when this browser tab answers
// them
const question = computed(() => {
  const request = latest.value;
  if ((owner.value !== 'here') || (request?.status !== 'waiting') ||
    (chat.value.openRequest._id !== request._id)) {
    return null;
  }
  return request.asks?.find(ask => ask.kind === 'question') || null;
});
// The plan of the chat's latest request while it is open, folded once it
// failed. Cancel reverts what it did, so not once a cancel is under way
const plan = computed(() => {
  const request = latest.value;
  if (!request?.plan?.length || request.revertId) {
    return null;
  }
  const cancellable = !request.planCancelled && !store.checking[props.chatId] &&
    !chat.value?.openRevert;
  if ([ 'running', 'stopping', 'waiting' ].includes(request.status)) {
    return {
      request,
      failed: false,
      cancellable: cancellable && (request.status !== 'stopping')
    };
  }
  return (request.status === 'failed')
    ? {
      request,
      failed: true,
      cancellable
    }
    : null;
});

onMounted(() => apos.bus.$on('refreshed', readEditMode));
onBeforeUnmount(() => {
  apos.bus.$off('refreshed', readEditMode);
  clearTimeout(searchTimer);
});

function readEditMode() {
  editMode.value = Boolean(window.apos.adminBar?.editMode);
}

// A shortcut into edit mode, where clicking widgets selects them
async function selectOnPage() {
  await window.apos.adminBar.setEditMode(true);
  readEditMode();
}

function onInput(value) {
  store.setDraft(props.chatId, value);
}

// A new `@` opens the list again after Escape closed it
function onQuery(value) {
  if ((value === null) || (query.value === null)) {
    closed.value = false;
  }
  if (value === query.value) {
    return;
  }
  query.value = value;
  search(value);
}

// A search a moment after the letters stop; an answer to an older one is
// dropped
function search(value) {
  clearTimeout(searchTimer);
  const id = ++searches;
  if (value === null) {
    results.value = null;
    return;
  }
  searchTimer = setTimeout(async () => {
    try {
      const found = await store.findMentions(value);
      if (id === searches) {
        results.value = found;
        active.value = 0;
      }
    } catch (e) {
      if (id === searches) {
        results.value = [];
      }
    }
  }, 120);
}

// The list takes its keys before the editing area does
function onKey(event) {
  if (!listOpen.value) {
    return;
  }
  const count = results.value.length;
  if ((event.key === 'ArrowDown') && count) {
    active.value = (active.value + 1) % count;
  } else if ((event.key === 'ArrowUp') && count) {
    active.value = (active.value + count - 1) % count;
  } else if ([ 'Enter', 'Tab' ].includes(event.key) && count && !event.isComposing) {
    pick(results.value[active.value]);
  } else if (event.key === 'Escape') {
    closed.value = true;
    escaped = true;
  } else {
    return;
  }
  event.preventDefault();
}

// The window closes on Escape's keyup, so the one that closed the list
// stops here
function onEscapeUp(event) {
  if (escaped) {
    escaped = false;
    event.stopPropagation();
  }
}

function pick(item) {
  input.value.insertMention({
    id: item._id,
    title: item.title,
    kind: item.kind
  });
}

async function send() {
  if (!canSend.value) {
    return;
  }
  sending.value = true;
  try {
    await store.send(props.chatId);
  } finally {
    sending.value = false;
  }
}

function stop() {
  if (!stopping.value) {
    store.stop(props.chatId);
  }
}

// The dock's one action: Continue here
function onDockAction() {
  store.continueHere(props.chatId);
}

function cancelPlan() {
  store.cancelPlan(props.chatId, latest.value._id);
}
</script>

<style lang="scss" scoped>
  // Shrinks only when its dock outgrows the panel; the dock scrolls then
  .apos-assistant-composer {
    display: flex;
    flex: 0 1 auto;
    flex-direction: column;
    min-height: 0;
    padding: 10px 20px 20px;
  }

  .apos-assistant-composer__shell {
    z-index: $z-index-default;
    position: relative;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    padding: 6px;
    border: 1px solid color-mix(in srgb, var(--a-primary) 25%, transparent);
    transition: border-color 200ms, box-shadow 200ms;
    gap: 4px;
    border-radius: var(--a-border-radius-large);
    background-color: var(--a-background-primary);

    &:focus-within {
      border-color: color-mix(in srgb, var(--a-primary) 75%, transparent);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--a-primary) 20%, transparent);
    }
  }

  .apos-assistant-mention {
    z-index: $z-index-default;
    position: absolute;
    right: 0;
    bottom: calc(100% + 5px);
    left: 0;
    display: flex;
    flex-direction: column;
    padding: 5px;
    border: 1px solid color-mix(in srgb, var(--a-base-7) 60%, transparent);
    gap: 4px;
    border-radius: var(--a-border-radius-large);
    background-color: var(--a-background-primary);
    box-shadow: var(--a-box-shadow);
  }

  .apos-assistant-mention__list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .apos-assistant-mention__option {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 5px 10px;
    color: var(--a-text-primary);
    font-size: var(--a-type-base);
    line-height: var(--a-line-tall);
    cursor: pointer;
    gap: 10px;
    border-radius: var(--a-border-radius);
  }

  .apos-assistant-mention__option--active {
    background-color: var(--a-base-10);
  }

  .apos-assistant-mention__hint {
    color: var(--a-base-2);
    font-size: var(--a-type-smaller);
  }

  .apos-assistant-mention__empty {
    margin: 0;
    padding: 8px 10px;
    color: var(--a-base-2);
    font-size: var(--a-type-base);
  }

  .apos-assistant-composer__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }

  .apos-assistant-composer__send {
    @include apos-button-reset();

    & {
      display: grid;
      flex-shrink: 0;
      place-items: center;
      width: 23px;
      height: 23px;
      border-radius: 50%;
      color: var(--a-white);
      background-color: var(--a-primary);
      transition: background-color 200ms, color 200ms;
    }

    &:hover:not(:disabled, [aria-disabled]) {
      background-color: var(--a-primary-dark-10);
    }

    &:disabled,
    &[aria-disabled] {
      color: var(--a-base-5);
      background-color: var(--a-base-9);
      cursor: default;
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }
  }

  .apos-assistant-composer__tool {
    @include apos-button-reset();

    & {
      display: grid;
      place-items: center;
      width: 23px;
      height: 23px;
      margin-right: auto;
      color: var(--a-base-3);
      border-radius: var(--a-border-radius);
      transition: color 200ms, background-color 200ms;
    }

    svg {
      width: 14px;
      height: 14px;
    }

    &:hover {
      color: var(--a-primary);
      background-color: var(--a-base-10);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }
  }
</style>
