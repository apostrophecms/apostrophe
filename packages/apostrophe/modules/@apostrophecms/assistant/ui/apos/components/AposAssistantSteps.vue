<template>
  <div
    class="apos-assistant-steps"
    data-apos-test="assistant-steps"
  >
    <button
      type="button"
      class="apos-assistant-steps__trigger"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="listId"
      data-apos-test="assistant-steps-toggle"
      @click="open = !open"
    >
      <span class="apos-assistant-steps__summary">{{ summary }}</span>
      <AposIndicator
        class="apos-assistant-steps__chevron"
        :class="{ 'apos-assistant-steps__chevron--open': open }"
        icon="chevron-down-icon"
        :icon-size="14"
      />
    </button>
    <ol
      v-show="open"
      :id="listId"
      class="apos-assistant-steps__list"
    >
      <li
        v-for="step in steps"
        :key="step.id"
        class="apos-assistant-steps__step"
        data-apos-test="assistant-step"
      >
        <button
          type="button"
          class="apos-assistant-steps__step-trigger"
          :aria-expanded="opened[step.id] ? 'true' : 'false'"
          @click="opened[step.id] = !opened[step.id]"
        >
          <span class="apos-assistant-steps__label">
            {{ step.label ? $t(step.label) : step.name }}
          </span>
          <AposIndicator
            class="apos-assistant-steps__chevron"
            :class="{ 'apos-assistant-steps__chevron--open': opened[step.id] }"
            icon="chevron-down-icon"
            :icon-size="14"
          />
        </button>
        <div
          v-if="opened[step.id]"
          class="apos-assistant-steps__details"
        >
          <!-- The model's arguments and a tool's result are text here,
            never markup -->
          <div
            v-for="block in getBlocks(step)"
            :key="block.name"
            class="apos-assistant-steps__block"
          >
            <div class="apos-assistant-steps__block-header">
              <p class="apos-assistant-steps__block-title">
                {{ $t(block.title) }}
              </p>
              <button
                type="button"
                class="apos-assistant-steps__copy"
                :aria-label="$t('apostrophe:assistantCopy', { title: $t(block.title) })"
                :title="$t('apostrophe:assistantCopy', { title: $t(block.title) })"
                @click="copy(step.id, block)"
              >
                <AposIndicator
                  :icon="(copied === `${step.id}:${block.name}`) ? 'check-icon' : 'content-copy-icon'"
                  :icon-size="12"
                />
              </button>
            </div>
            <pre class="apos-assistant-steps__code"><code>{{ block.text }}</code></pre>
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>

<script setup>
import {
  computed, inject, reactive, ref
} from 'vue';
import { createId } from 'apostrophe/lib/beneath.js';

// The steps a request took, listed once it ends: each tool call, which the
// editor can open to see what it was given and what came back
const props = defineProps({
  request: {
    type: Object,
    required: true
  }
});

const COPIED_FOR = 1500;

const $t = inject('i18n');
const listId = `apos-assistant-steps-${createId()}`;
const open = ref(true);
const opened = reactive({});
const copied = ref(null);
let copiedTimer = null;

const steps = computed(() => props.request.steps || []);

// How long the request worked, or how many steps it took when it hasn't
// ended (it waits for an answer)
const summary = computed(() => {
  const { createdAt, endedAt } = props.request;
  if (!endedAt) {
    return $t('apostrophe:assistantStepCount', { count: steps.value.length });
  }
  const total = Math.max(1, Math.round((new Date(endedAt) - new Date(createdAt)) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const duration = minutes
    ? $t('apostrophe:assistantMinutes', {
      minutes,
      seconds
    })
    : $t('apostrophe:assistantSeconds', { seconds });
  return $t('apostrophe:assistantThoughtFor', { duration });
});

function getBlocks(step) {
  return [
    step.input && {
      name: 'input',
      title: 'apostrophe:assistantStepArguments',
      text: step.input
    },
    step.error && {
      name: 'error',
      title: 'apostrophe:assistantStepError',
      text: step.error
    },
    step.output && {
      name: 'output',
      title: 'apostrophe:assistantStepResult',
      text: step.output
    }
  ].filter(Boolean);
}

async function copy(stepId, block) {
  try {
    await navigator.clipboard.writeText(block.text);
  } catch (e) {
    // The text stays selectable
    return;
  }
  copied.value = `${stepId}:${block.name}`;
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copied.value = null;
  }, COPIED_FOR);
}
</script>

<style lang="scss" scoped>
  .apos-assistant-steps {
    min-width: 0;
  }

  .apos-assistant-steps__trigger,
  .apos-assistant-steps__step-trigger {
    @include apos-button-reset();

    & {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 100%;
      border-radius: var(--a-border-radius);
      text-align: start;
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }
  }

  .apos-assistant-steps__summary,
  .apos-assistant-steps__label {
    @include type-label;

    & {
      min-width: 0;
      color: var(--a-base-1);
      font-weight: var(--a-weight-base);
    }
  }

  .apos-assistant-steps__chevron {
    flex-shrink: 0;
    color: var(--a-base-3);
    opacity: 0;
    transition: opacity 200ms ease, transform 200ms ease;
    transform: rotate(-90deg);
  }

  .apos-assistant-steps__chevron--open {
    transform: rotate(0deg);
  }

  .apos-assistant-steps__trigger:hover .apos-assistant-steps__chevron,
  .apos-assistant-steps__trigger:focus-visible .apos-assistant-steps__chevron,
  .apos-assistant-steps__trigger[aria-expanded='true'] .apos-assistant-steps__chevron,
  .apos-assistant-steps__step-trigger:hover .apos-assistant-steps__chevron,
  .apos-assistant-steps__step-trigger:focus-visible .apos-assistant-steps__chevron,
  .apos-assistant-steps__step-trigger[aria-expanded='true'] .apos-assistant-steps__chevron {
    opacity: 1;
  }

  .apos-assistant-steps__list {
    display: flex;
    flex-direction: column;
    margin: 4px 0 0 3px;
    padding: 0 0 0 12px;
    border-left: 1px solid var(--a-base-8);
    list-style: none;
  }

  .apos-assistant-steps__step-trigger {
    padding: 3px 0;
  }

  .apos-assistant-steps__details {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 4px 0 10px;
  }

  .apos-assistant-steps__block {
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--a-base-7) 70%, transparent);
    border-radius: var(--a-border-radius-large);
    background-color: var(--a-background-primary);
  }

  .apos-assistant-steps__block-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-right: 4px;
    border-bottom: 1px solid var(--a-base-8);
    background-color: var(--a-base-10);
  }

  .apos-assistant-steps__block-title {
    @include type-small;

    & {
      margin: 0;
      padding: 4px 8px;
      color: var(--a-base-1);
      font-weight: var(--a-weight-bold);
    }
  }

  .apos-assistant-steps__copy {
    @include apos-button-reset();

    & {
      display: grid;
      place-items: center;
      width: 20px;
      height: 20px;
      border-radius: var(--a-border-radius);
      color: var(--a-base-4);
      opacity: 0;
      transition: opacity 200ms, color 200ms;
    }

    &:hover {
      color: var(--a-text-primary);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 1px;
      opacity: 1;
    }
  }

  .apos-assistant-steps__block:hover .apos-assistant-steps__copy {
    opacity: 1;
  }

  .apos-assistant-steps__code {
    @include type-small;

    & {
      overflow: auto;
      max-height: 220px;
      margin: 0;
      padding: 4px 10px;
      color: var(--a-text-primary);
      line-height: 1.45;
      white-space: pre;
      tab-size: 2;
    }
  }
</style>
