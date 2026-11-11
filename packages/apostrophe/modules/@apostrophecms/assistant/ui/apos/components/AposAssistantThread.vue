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
      v-for="request in requests"
      :key="request._id"
      :request="request"
    />
  </div>
</template>

<script setup>
import {
  computed, nextTick, onMounted, ref, watch
} from 'vue';
import { useAssistantStore } from '../stores/assistant.js';

// One chat's requests, oldest first. The thread follows new content while
// the editor reads its end, and stays where they scrolled to otherwise
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
let atEnd = true;

const requests = computed(() => store.requests[props.chatId] || []);

onMounted(scrollToEnd);

watch(() => [ requests.value, store.progress ], async () => {
  if (atEnd) {
    await scrollToEnd();
  }
}, { deep: true });

function onScroll() {
  const el = root.value;
  atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < END_SLACK;
}

async function scrollToEnd() {
  await nextTick();
  if (root.value) {
    root.value.scrollTop = root.value.scrollHeight;
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
