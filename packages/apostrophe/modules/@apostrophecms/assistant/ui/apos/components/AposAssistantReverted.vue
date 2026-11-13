<template>
  <div
    class="apos-assistant-reverted"
    data-apos-test="assistant-reverted"
    :data-apos-status="revert.status"
  >
    <AposAssistantActivity
      tone="general"
      :title="title"
      :text="text"
    />
    <p
      v-if="running"
      class="apos-assistant-reverted__status"
      aria-live="polite"
      data-apos-test="assistant-revert-status"
    >
      <AposAssistantThinking />
      <span>{{ status }}</span>
    </p>
    <AposAssistantActivity
      v-else-if="failed"
      tone="error"
      :title="failed.title"
      :text="failed.text"
      :actions="[ {
        name: 'retry',
        label: $t('apostrophe:assistantRetry'),
        disabled: busy
      } ]"
      @action="retry"
    />
    <AposAssistantActivity
      v-if="!running && listed.length && !revert.dismissed"
      tone="warning"
      :title="listTitle"
      :dismiss-label="$t('apostrophe:assistantRevertDismiss')"
      data-apos-test="assistant-revert-kept"
      @dismiss="dismiss"
    >
      <ul class="apos-assistant-reverted__list">
        <li
          v-for="doc in listed"
          :key="doc.docId"
          class="apos-assistant-reverted__doc"
          data-apos-test="assistant-revert-kept-doc"
          :data-apos-outcome="doc.outcome"
        >
          <span class="apos-assistant-reverted__main">
            <span class="apos-assistant-reverted__title">{{ getTitle(doc, $t) }}</span>
            <span class="apos-assistant-reverted__reason">{{ getReason(doc, $t) }}</span>
          </span>
          <span class="apos-assistant-reverted__links">
            <button
              v-if="doc.view"
              type="button"
              class="apos-assistant-reverted__link"
              :data-apos-test="`assistant-revert-${doc.view}`"
              @click="showDocument(doc)"
            >
              {{ $t((doc.view === 'seeChanges') ? 'apostrophe:assistantRevertSeeChanges' : 'apostrophe:assistantRevertVersions') }}
            </button>
            <button
              v-if="doc.outcome === 'locked'"
              type="button"
              class="apos-assistant-reverted__link"
              :aria-disabled="busy ? 'true' : null"
              data-apos-test="assistant-revert-retry"
              @click="retry"
            >
              {{ $t('apostrophe:assistantRetry') }}
            </button>
          </span>
        </li>
      </ul>
    </AposAssistantActivity>
  </div>
</template>

<script setup>
import {
  computed, inject, ref
} from 'vue';
import { useAssistantStore } from '../stores/assistant.js';
import {
  getNotReverted, getReason, getRevertFailure, getRevertStatus, getTitle, showDocument
} from '../lib/revert.js';

// A done revert where its requests were: what it says it did, then the
// documents it did not put back, until dismissed. Retry runs it again for
// the locked ones, with its progress here
const props = defineProps({
  revert: {
    type: Object,
    required: true
  }
});

const $t = inject('i18n');
const store = useAssistantStore();
const busy = ref(false);

const running = computed(() => props.revert.status === 'running');
const count = computed(() => props.revert.requestIds.length);
const title = computed(() => ((props.revert.cause === 'planCancel')
  ? $t('apostrophe:assistantPlanCancelledTitle')
  : $t('apostrophe:assistantReverted', { count: count.value })));
const text = computed(() => $t((props.revert.cause === 'planCancel')
  ? 'apostrophe:assistantPlanCancelledText'
  : 'apostrophe:assistantRevertedText'));
const status = computed(() => getRevertStatus(props.revert, store.revertProgress, $t));
// A retry for the locked documents that failed
const failed = computed(() => ((props.revert.status === 'failed')
  ? getRevertFailure(props.revert, $t)
  : null));
const listed = computed(() => getNotReverted(props.revert));
const listTitle = computed(() => $t(listed.value.some(doc => doc.partly)
  ? 'apostrophe:assistantRevertNotFully'
  : 'apostrophe:assistantRevertNotReverted', { count: listed.value.length }));

async function retry() {
  if (busy.value) {
    return;
  }
  busy.value = true;
  try {
    await store.retryRevert(props.revert.chatId, props.revert._id);
  } finally {
    busy.value = false;
  }
}

function dismiss() {
  store.dismissRevert(props.revert.chatId, props.revert._id);
}
</script>

<style lang="scss" scoped>
  .apos-assistant-reverted {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  .apos-assistant-reverted__status {
    @include type-label;

    & {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0;
      padding: 4px 2px 0;
    }
  }

  .apos-assistant-reverted__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
  }

  .apos-assistant-reverted__doc {
    @include type-base;

    & {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      min-width: 0;
      line-height: var(--a-line-tall);
    }
  }

  .apos-assistant-reverted__main {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .apos-assistant-reverted__title {
    overflow: hidden;
    color: var(--a-text-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .apos-assistant-reverted__reason {
    color: var(--a-base-1);
  }

  .apos-assistant-reverted__links {
    display: flex;
    flex-shrink: 0;
    gap: 12px;
  }

  .apos-assistant-reverted__link {
    @include apos-button-reset();
    @include type-base;

    & {
      border-radius: var(--a-border-radius);
      color: var(--a-warning-dark);
      line-height: var(--a-line-tall);
    }

    &:hover:not([aria-disabled]) {
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 1px solid var(--a-warning-dark);
      outline-offset: 2px;
    }

    &[aria-disabled] {
      opacity: 0.5;
      cursor: default;
    }
  }
</style>
