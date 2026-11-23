<template>
  <div
    class="apos-assistant-action-request"
    data-apos-test="assistant-action-request"
    :data-apos-status="request.status"
  >
    <p
      v-if="running"
      class="apos-assistant-action-request__status"
      aria-live="polite"
      data-apos-test="assistant-request-status"
    >
      <AposAssistantThinking />
      <span>{{ $t('apostrophe:assistantWorking') }}</span>
    </p>
    <AposAssistantNotices :request="request" />
    <AposAssistantActivity
      v-if="request.status === 'failed'"
      tone="error"
      :title="$t('apostrophe:assistantError')"
      :text="$t('apostrophe:assistantErrorText')"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import AposAssistantNotices from './AposAssistantNotices.vue';

// A request a notice's button ran (Retry on "Not saved to Media"): no
// message of the editor's and no model, so the thread shows it by its
// notices only, and while it runs
const props = defineProps({
  request: {
    type: Object,
    required: true
  }
});

const running = computed(() => [ 'running', 'stopping' ].includes(props.request.status));
</script>

<style lang="scss" scoped>
  .apos-assistant-action-request {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  .apos-assistant-action-request__status {
    @include type-base;

    & {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      color: var(--a-base-2);
      line-height: var(--a-line-tall);
    }
  }
</style>
