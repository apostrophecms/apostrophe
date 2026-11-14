<template>
  <div
    ref="root"
    class="apos-assistant-thread"
    :class="{ 'apos-assistant-thread--empty': !items.length }"
    data-apos-test="assistant-thread"
    @scroll.passive="onScroll"
  >
    <div
      v-if="!items.length"
      class="apos-assistant-thread__empty"
    >
      <p class="apos-assistant-thread__greeting">
        {{ $t('apostrophe:assistantGreeting') }}
      </p>
    </div>
    <template
      v-for="item in items"
      :key="item.key"
    >
      <AposAssistantRequest
        v-if="item.message"
        ref="messageItems"
        :request="item.message.request"
        :retried="item.message.retried"
        :latest="item.message.request === requests.at(-1)"
        :revert-from="item.message._id"
        :after="item.after"
        :confirmation="(confirmation?.requestId === item.message._id)
          ? confirmation
          : null"
        :revert="(pending?.requestIds[0] === item.message._id) ? pending : null"
      />
      <AposAssistantReverted
        v-else
        :revert="item.revert"
      />
    </template>
  </div>
</template>

<script setup>
import {
  computed, nextTick, onBeforeUnmount, onMounted, ref, watch
} from 'vue';
import { getTabId } from 'Modules/@apostrophecms/ui/utils';
import { useAssistantStore } from '../stores/assistant.js';

// One chat's messages, oldest first, each pinned at the top while the
// editor reads what came of it. The thread follows its end until the
// editor scrolls up to read, and again once they scroll back down to it;
// a message of their own always takes them to the end.
//
// Reverted requests leave the thread, and their revert stands where they
// were. While a revert waits on its confirmation or runs, the requests it
// takes after the clicked one are already out of view
const props = defineProps({
  // A chat id, or the new chat's
  chatId: {
    type: String,
    required: true
  }
});

// How close to the end counts as back at it, scrolling down
const END_SLACK = 40;

const store = useAssistantStore();
const root = ref(null);
const messageItems = ref([]);
let following = true;
let lastTop = 0;
let frame = null;
let resizing = null;
const known = new Set();

// Every request of the chat, reverted ones included
const all = computed(() => store.requests[props.chatId] || []);
const requests = computed(() => all.value.filter(request => !request.revertId));
const reverts = computed(() => store.reverts[props.chatId] || []);
const confirmation = computed(() => store.confirmations[props.chatId] || null);

// A retry runs under the message it repeats: each message shows its latest
// request
const messages = computed(() => {
  const list = [];
  const byRequest = new Map();
  for (const request of requests.value) {
    const message = request.retryOf && byRequest.get(request.retryOf);
    if (message) {
      message.request = request;
      message.retried = true;
    } else {
      list.push({
        _id: request._id,
        request,
        retried: false
      });
    }
    byRequest.set(request._id, message || list.at(-1));
  }
  return list;
});

// The revert still on its clicked request: running for the first time, or
// failed with nothing sent since, so its Retry takes the same requests
const pending = computed(() => {
  const last = reverts.value.at(-1);
  if (!last || ![ 'running', 'failed' ].includes(last.status) ||
    all.value.some(request => request.revertId === last._id)) {
    return null;
  }
  const first = all.value.find(request => request._id === last.requestIds[0]);
  const since = requests.value
    .filter(request => request.sequence >= (first?.sequence ?? Infinity))
    .map(request => request._id);
  return ((last.status === 'running') || (since.join() === last.requestIds.join()))
    ? last
    : null;
});

// The requests on their way out: those after the clicked one
const leaving = computed(() => {
  const ids = confirmation.value?.requestIds ||
    ((pending.value?.status === 'running') ? pending.value.requestIds : []);
  return new Set(ids.slice(1));
});

// Messages and done reverts in the order of their requests. Each message
// knows how many follow it
const items = computed(() => {
  const sequences = new Map(all.value.map(request => [ request._id, request.sequence ]));
  const shown = messages.value.filter(message => !leaving.value.has(message._id));
  const list = shown.map((message, index) => ({
    key: message._id,
    sequence: sequences.get(message._id),
    message,
    after: shown.length - index - 1
  }));
  for (const revert of reverts.value) {
    if (all.value.some(request => request.revertId === revert._id)) {
      list.push({
        key: revert._id,
        sequence: sequences.get(revert.requestIds[0]),
        revert
      });
    }
  }
  return list.sort((one, two) => one.sequence - two.sequence);
});

onMounted(() => {
  for (const request of requests.value) {
    known.add(request._id);
  }
  scrollToEnd();
  // Less room (a dock over the composer) keeps the end in view
  resizing = new ResizeObserver(() => {
    if (following) {
      scrollToEnd();
    }
  });
  resizing.observe(root.value);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  resizing?.disconnect();
});

watch(() => [ items.value, store.progress, store.revertProgress ], async () => {
  if (sentHere()) {
    following = true;
  }
  if (following) {
    await scrollToEnd();
  }
  await nextTick();
  markPinned();
}, { deep: true });

// Whether a request this browser tab sent (a message or a retry) has just
// appeared
function sentHere() {
  let sent = false;
  for (const request of requests.value) {
    if (!known.has(request._id)) {
      known.add(request._id);
      sent = sent || (request.tabId === getTabId());
    }
  }
  return sent;
}

// Up and away from the end is the editor reading. A shrinking thread can
// move it up too, but leaves it at the end
function onScroll() {
  const el = root.value;
  const top = el.scrollTop;
  const fromEnd = el.scrollHeight - top - el.clientHeight;
  if ((top < lastTop) && (fromEnd > 1)) {
    following = false;
  } else if ((top > lastTop) && (fromEnd < END_SLACK)) {
    following = true;
  }
  lastTop = top;
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(markPinned);
}

async function scrollToEnd() {
  await nextTick();
  if (root.value) {
    root.value.scrollTop = root.value.scrollHeight;
    markPinned();
  }
}

// A message is pinned once the spot it sits in when not pinned has
// scrolled above the thread's top
function markPinned() {
  const el = root.value;
  if (!el) {
    return;
  }
  const top = el.getBoundingClientRect().top;
  for (const item of messageItems.value) {
    const sentinel = item.$el.firstElementChild;
    const pin = sentinel.nextElementSibling;
    pin.dataset.stuck = String(sentinel.getBoundingClientRect().top < top + 2);
  }
}
</script>

<style lang="scss" scoped>
  // Only the room the composer leaves: a tall question dock takes it first
  .apos-assistant-thread {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    gap: 20px;
    min-height: 0;
    padding: 20px 20px 10px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .apos-assistant-thread--empty {
    justify-content: center;
  }

  .apos-assistant-thread__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: 20px 0;
  }

  .apos-assistant-thread__greeting {
    @include type-title;

    & {
      margin: 0;
      color: var(--a-text-primary);
      text-align: center;
    }
  }
</style>
