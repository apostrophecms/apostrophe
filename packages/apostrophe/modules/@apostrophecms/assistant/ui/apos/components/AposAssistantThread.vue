<template>
  <div
    ref="root"
    class="apos-assistant-thread"
    :class="{ 'apos-assistant-thread--empty': !requests.length }"
    data-apos-test="assistant-thread"
    @scroll.passive="onScroll"
  >
    <div
      v-if="!requests.length"
      class="apos-assistant-thread__empty"
    >
      <p class="apos-assistant-thread__greeting">
        {{ $t('apostrophe:assistantGreeting') }}
      </p>
    </div>
    <AposAssistantRequest
      v-for="message in messages"
      ref="items"
      :key="message._id"
      :request="message.request"
      :retried="message.retried"
      :latest="message.request === requests.at(-1)"
    />
  </div>
</template>

<script setup>
import {
  computed, nextTick, onBeforeUnmount, onMounted, ref, watch
} from 'vue';
import { useAssistantStore } from '../stores/assistant.js';

// One chat's messages, oldest first, each pinned at the top while the
// editor reads what came of it. The thread follows new content while the
// editor reads its end, and stays where they scrolled to otherwise
const props = defineProps({
  // A chat id, or the new chat's
  chatId: {
    type: String,
    required: true
  }
});

// How close to the end still counts as reading the end
const END_SLACK = 40;

const store = useAssistantStore();
const root = ref(null);
const items = ref([]);
let atEnd = true;
let frame = null;

const requests = computed(() => store.requests[props.chatId] || []);

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

onMounted(scrollToEnd);
onBeforeUnmount(() => cancelAnimationFrame(frame));

watch(() => [ requests.value, store.progress ], async () => {
  if (atEnd) {
    await scrollToEnd();
  }
  await nextTick();
  markPinned();
}, { deep: true });

function onScroll() {
  const el = root.value;
  atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < END_SLACK;
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
  for (const item of items.value) {
    const sentinel = item.$el.firstElementChild;
    const pin = sentinel.nextElementSibling;
    pin.dataset.stuck = String(sentinel.getBoundingClientRect().top < top + 2);
  }
}
</script>

<style lang="scss" scoped>
  .apos-assistant-thread {
    display: flex;
    flex: 1 1 auto;
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
