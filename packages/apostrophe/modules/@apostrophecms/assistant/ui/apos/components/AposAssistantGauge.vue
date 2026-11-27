<template>
  <span
    v-if="percent !== null"
    class="apos-assistant-gauge"
    role="meter"
    tabindex="0"
    :aria-label="$t('aposAssistant:assistantChatLength')"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="percent"
    :aria-valuetext="sentence"
    :aria-describedby="tokens ? tipId : null"
    data-apos-test="assistant-gauge"
  >
    <svg
      viewBox="0 0 18 18"
      aria-hidden="true"
    >
      <circle
        class="apos-assistant-gauge__track"
        cx="9"
        cy="9"
        r="8.2"
      />
      <circle
        v-if="percent >= 100"
        class="apos-assistant-gauge__fill"
        cx="9"
        cy="9"
        r="6"
      />
      <path
        v-else
        class="apos-assistant-gauge__fill"
        :d="slice"
      />
    </svg>
    <span
      :id="tipId"
      class="apos-assistant-gauge__tip"
      role="tooltip"
      data-apos-test="assistant-gauge-tip"
    >
      <span>{{ sentence }}</span>
      <span
        v-if="tokens"
        class="apos-assistant-gauge__tokens"
      >{{ tokens }}</span>
    </span>
  </span>
</template>

<script setup>
import { computed, inject } from 'vue';
import { createId } from 'apostrophe/lib/beneath.js';
import { useAssistantStore } from '../stores/assistant.js';

// How far a chat is to shortening its earlier messages, as a pie among the
// composer's tools. Shown from half way only, in one colour at every level:
// reaching the point is harmless, the chat is shortened and goes on. It
// changes when a request ends; a run holds the last value
const props = defineProps({
  chatId: {
    type: String,
    required: true
  }
});

// Under this, most chats, no gauge
const SHOWN_FROM = 50;

const $t = inject('i18n');
const store = useAssistantStore();
const { usageDisplay } = apos.modules['@apostrophecms/assistant'];
const tipId = `apos-assistant-gauge-${createId()}`;

const length = computed(() => store.getChat(props.chatId)?.length || null);
const percent = computed(() => {
  const { measure, threshold } = length.value || {};
  if (!threshold) {
    return null;
  }
  const value = Math.min(Math.round(measure / threshold * 100), 100);
  return (value >= SHOWN_FROM) ? value : null;
});
const sentence = computed(() => ((percent.value >= 100)
  ? $t('aposAssistant:assistantGaugeFull')
  : $t('aposAssistant:assistantGaugePercent', { percent: percent.value })));
const tokens = computed(() => {
  if ((usageDisplay !== 'tokens') || (percent.value >= 100)) {
    return null;
  }
  const format = new Intl.NumberFormat(apos.i18n.adminLocale, {
    notation: 'compact',
    maximumFractionDigits: 1
  });
  return $t('aposAssistant:assistantGaugeTokens', {
    measure: format.format(length.value.measure),
    threshold: format.format(length.value.threshold)
  });
});
// Clockwise from the top: a partial ring would read as a spinner
const slice = computed(() => {
  const angle = percent.value / 100 * 2 * Math.PI;
  const x = (9 + 6 * Math.sin(angle)).toFixed(2);
  const y = (9 - 6 * Math.cos(angle)).toFixed(2);
  return `M9 9 L9 3 A6 6 0 ${(angle > Math.PI) ? 1 : 0} 1 ${x} ${y} Z`;
});
</script>

<style lang="scss" scoped>
  // The composer's tools' size, colour and stroke
  .apos-assistant-gauge {
    position: relative;
    display: grid;
    place-items: center;
    width: 23px;
    height: 23px;
    border-radius: var(--a-border-radius);
    color: var(--a-base-3);
    transition: background-color 200ms;

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover,
    &:focus-visible {
      background-color: var(--a-base-10);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }
  }

  .apos-assistant-gauge__track {
    fill: none;
    stroke: currentcolor;
    stroke-width: 1.5;
  }

  .apos-assistant-gauge__fill {
    fill: currentcolor;
  }

  .apos-assistant-gauge__tip {
    @include type-small;

    & {
      z-index: $z-index-notifications;
      position: absolute;
      bottom: calc(100% + 8px);
      left: -4px;
      display: none;
      flex-direction: column;
      width: max-content;
      max-width: 285px;
      padding: 8px 10px;
      border-radius: 3px;
      color: var(--a-text-inverted);
      background: var(--a-background-inverted);
      line-height: var(--a-line-tall);
      pointer-events: none;
    }
  }

  .apos-assistant-gauge:hover .apos-assistant-gauge__tip,
  .apos-assistant-gauge:focus .apos-assistant-gauge__tip {
    display: flex;
  }

  .apos-assistant-gauge__tokens {
    opacity: 0.75;
  }
</style>
