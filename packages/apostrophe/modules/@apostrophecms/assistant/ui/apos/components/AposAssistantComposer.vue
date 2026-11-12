<template>
  <form
    class="apos-assistant-composer"
    data-apos-test="assistant-composer"
    @submit.prevent="send"
  >
    <AposAssistantDock
      v-if="dock"
      v-bind="dock"
      @action="onDockAction"
    />
    <div class="apos-assistant-composer__shell">
      <textarea
        ref="input"
        class="apos-assistant-composer__input"
        rows="2"
        :value="draft"
        :placeholder="$t('apostrophe:assistantPlaceholder')"
        :aria-label="$t('apostrophe:assistantMessage')"
        data-apos-test="assistant-input"
        @input="onInput"
        @keydown.enter="onEnter"
      />
      <div class="apos-assistant-composer__actions">
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
  computed, nextTick, onMounted, ref, watch
} from 'vue';
import { useAssistantStore } from '../stores/assistant.js';

// The composer of the active chat tab. It never takes focus on its own:
// only the editor's click or Tab puts it there
const props = defineProps({
  chatId: {
    type: String,
    required: true
  }
});

const MAX_HEIGHT = 160;

const store = useAssistantStore();
const input = ref(null);
const sending = ref(false);

const draft = computed(() => store.drafts[props.chatId] || '');
const chat = computed(() => store.getChat(props.chatId));
const owner = computed(() => store.getOwner(chat.value));
const canSend = computed(() => !sending.value &&
  !!draft.value.trim() &&
  (owner.value === 'none'));
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

onMounted(resize);
watch(draft, resize);

function onInput(event) {
  store.setDraft(props.chatId, event.target.value);
}

// Enter sends, Shift+Enter starts a new line, and a composition in
// progress (an input method) keeps its Enter
function onEnter(event) {
  if (event.shiftKey || event.isComposing) {
    return;
  }
  event.preventDefault();
  send();
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

async function resize() {
  await nextTick();
  const el = input.value;
  if (!el) {
    return;
  }
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
}
</script>

<style lang="scss" scoped>
  .apos-assistant-composer {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    padding: 10px 20px 20px;
  }

  .apos-assistant-composer__shell {
    z-index: $z-index-default;
    position: relative;
    display: flex;
    flex-direction: column;
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

  .apos-assistant-composer__input {
    @include type-label;

    & {
      overflow-y: auto;
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      min-height: 40px;
      padding: 4px 7px;
      border: none;
      background: none;
      line-height: 1.45;
      resize: none;
    }

    &::placeholder {
      color: var(--a-base-4);
    }

    &:focus {
      outline: none;
    }
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
</style>
