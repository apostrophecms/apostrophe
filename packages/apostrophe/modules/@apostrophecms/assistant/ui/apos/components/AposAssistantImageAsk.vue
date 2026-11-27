<template>
  <AposAssistantDock
    tone="default"
    role="group"
    :label="$t('aposAssistant:assistantPickImage')"
    data-apos-test="assistant-image-ask"
  >
    <template #toolbar>
      <p
        class="apos-assistant-image-ask__label"
        aria-live="polite"
        data-apos-test="assistant-image-ask-label"
      >
        {{ picked
          ? $t('aposAssistant:assistantOptionNext', { number: picked })
          : $t('aposAssistant:assistantPickImage') }}
      </p>
    </template>
    <template #aside>
      <button
        type="button"
        class="apos-assistant-image-ask__cancel"
        :disabled="sending"
        data-apos-test="assistant-image-ask-cancel"
        @click="answer({ action: 'cancel' })"
      >
        {{ $t('apostrophe:cancel') }}
      </button>
    </template>
    <div class="apos-assistant-image-ask__body">
      <div
        ref="grid"
        class="apos-assistant-image-ask__candidates"
        role="radiogroup"
        :aria-label="$t('aposAssistant:assistantPickImage')"
        @keydown="onGridKey"
      >
        <div
          v-for="(candidate, index) in candidates"
          :key="candidate._id"
          class="apos-assistant-image-ask__candidate"
          :class="{ 'apos-assistant-image-ask__candidate--picked': candidateId === candidate._id }"
        >
          <button
            type="button"
            class="apos-assistant-image-ask__pick"
            role="radio"
            :aria-checked="(candidateId === candidate._id) ? 'true' : 'false'"
            :aria-label="$t('aposAssistant:assistantOptionLabel', { number: index + 1 })"
            :tabindex="(focusIndex === index) ? 0 : -1"
            :disabled="sending"
            data-apos-test="assistant-image-ask-candidate"
            @click="pick(index)"
            @dblclick="zoom(candidate)"
          >
            <img
              class="apos-assistant-image-ask__image"
              :src="getFileUrl(chatId, candidate._id, 'thumbnail')"
              alt=""
              loading="lazy"
              decoding="async"
            >
            <span
              class="apos-assistant-image-ask__number"
              aria-hidden="true"
            >
              <svg
                v-if="candidateId === candidate._id"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />
              </svg>
              <template v-else>{{ index + 1 }}</template>
            </span>
          </button>
          <button
            type="button"
            class="apos-assistant-image-ask__zoom"
            :aria-label="$t('aposAssistant:assistantZoomOption', { number: index + 1 })"
            :title="$t('aposAssistant:assistantZoomOption', { number: index + 1 })"
            data-apos-test="assistant-image-ask-zoom"
            @click="zoom(candidate)"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M10,21V19H6.41L10.91,14.5L9.5,13.09L5,17.59V14H3V21H10M14.5,10.91L19,6.41V10H21V3H14V5H17.59L13.09,9.5L14.5,10.91Z" />
            </svg>
          </button>
        </div>
      </div>
      <p
        v-if="replaces"
        class="apos-assistant-image-ask__replaces"
        data-apos-test="assistant-image-ask-replaces"
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M19,19H5V5H19M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M13.96,12.29L11.21,15.83L9.25,13.47L6.5,17H17.5L13.96,12.29Z" />
        </svg>
        <span>{{ $t('aposAssistant:assistantReplacesInMedia', { title: replaces.title }) }}</span>
      </p>
      <button
        type="button"
        class="apos-assistant-image-ask__row"
        :class="{ 'apos-assistant-image-ask__row--picked': picked }"
        :disabled="sending || !picked"
        data-apos-test="assistant-image-ask-use"
        @click="answer({ action: 'use', candidate: candidateId })"
      >
        {{ picked
          ? $t('aposAssistant:assistantUseOption', { number: picked })
          : $t('aposAssistant:assistantSelectImage') }}
      </button>
      <button
        type="button"
        class="apos-assistant-image-ask__row"
        :disabled="sending"
        data-apos-test="assistant-image-ask-again"
        @click="answer({ action: 'again' })"
      >
        {{ $t('aposAssistant:assistantTryAgain') }}
      </button>
      <div class="apos-assistant-image-ask__refine">
        <span
          class="apos-assistant-image-ask__refine-label"
          aria-hidden="true"
        >{{ $t('aposAssistant:assistantRefine') }}</span>
        <input
          v-model="notes"
          type="text"
          class="apos-assistant-image-ask__input"
          :aria-label="$t('aposAssistant:assistantRefineLabel')"
          :placeholder="$t('aposAssistant:assistantRefinePlaceholder')"
          :disabled="sending"
          maxlength="2000"
          data-apos-test="assistant-image-ask-notes"
          @keydown.enter.prevent="!$event.isComposing && refine()"
        >
        <button
          type="button"
          class="apos-assistant-image-ask__send"
          :disabled="sending || !notes.trim()"
          data-apos-test="assistant-image-ask-refine"
          @click="refine"
        >
          {{ $t('aposAssistant:assistantSend') }}
        </button>
      </div>
    </div>
  </AposAssistantDock>
</template>

<script setup>
import {
  computed, inject, nextTick, ref, watch
} from 'vue';
import { useAssistantStore } from '../stores/assistant.js';
import { getFileUrl } from '../lib/attachments.js';

// A round of generated images, in the dock above the composer: pick one
// (a radio group: arrow keys move, Space or Enter picks), look at it large,
// then Use it, Try again, Refine it with notes, or Cancel. Refine never
// needs a pick: with one, it is what the next round edits. Nothing reaches
// Media before Use
const props = defineProps({
  chatId: {
    type: String,
    required: true
  },
  // The stored ask: `{ callId, payload: { candidates, replaces } }`
  ask: {
    type: Object,
    required: true
  }
});

const $t = inject('i18n');
const store = useAssistantStore();
const grid = ref(null);
const candidateId = ref(null);
const notes = ref('');
// The candidate the radio group's Tab stop is on
const focusIndex = ref(0);
const candidates = computed(() => props.ask.payload.candidates || []);
const replaces = computed(() => props.ask.payload.replaces || null);
// The option number picked, 1-based, or 0
const picked = computed(() => candidates.value
  .findIndex(candidate => candidate._id === candidateId.value) + 1);
const sending = computed(() => store.isPending(props.chatId, 'answer') ||
  store.isPending(props.chatId, 'stop'));

// A new round starts unpicked; an answer the server refused comes back
watch(() => [ props.ask.callId, props.ask.payload.round ], () => {
  const given = store.takeRefusedAnswer(props.ask.callId);
  candidateId.value = candidates.value.some(each => each._id === given?.candidate)
    ? given.candidate
    : null;
  notes.value = given?.notes || '';
  focusIndex.value = Math.max(0, picked.value - 1);
}, { immediate: true });

function pick(index) {
  candidateId.value = candidates.value[index]._id;
  focusIndex.value = index;
}

async function onGridKey(event) {
  const moves = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1
  };
  const by = moves[event.key];
  if (!by || !event.target.matches('[role="radio"]')) {
    return;
  }
  event.preventDefault();
  const { length } = candidates.value;
  pick((focusIndex.value + by + length) % length);
  await nextTick();
  grid.value.querySelectorAll('[role="radio"]')[focusIndex.value]?.focus();
}

function zoom(candidate) {
  const index = candidates.value.indexOf(candidate);
  apos.modal.execute('AposAssistantLightbox', {
    src: getFileUrl(props.chatId, candidate._id, 'preview'),
    alt: $t('aposAssistant:assistantOptionLabel', { number: index + 1 })
  });
}

function refine() {
  const text = notes.value.trim();
  if (!text || sending.value) {
    return;
  }
  answer({
    action: 'refine',
    notes: text,
    ...(candidateId.value && { candidate: candidateId.value })
  });
}

function answer(value) {
  if (!sending.value) {
    store.answer(props.chatId, props.ask.callId, value);
  }
}
</script>

<style lang="scss" scoped>
  .apos-assistant-image-ask__label {
    @include type-base;

    & {
      flex: 1 1 auto;
      min-width: 0;
      margin: 0;
      padding: 6px 0;
      color: var(--a-base-1);
      line-height: var(--a-line-tall);
    }
  }

  .apos-assistant-image-ask__cancel {
    @include apos-button-reset();
    @include type-small;

    & {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      height: 22px;
      padding: 0 10px;
      border: 1px solid var(--a-base-7);
      color: var(--a-text-primary);
      border-radius: var(--a-border-radius);
      background-color: var(--a-background-primary);
    }

    &:hover:not(:disabled) {
      border-color: var(--a-base-5);
      background-color: var(--a-base-10);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }

    &:disabled {
      border-color: var(--a-base-8);
      color: var(--a-base-5);
      cursor: default;
    }
  }

  // The dock scrolls when the panel is short, so the composer stays in view
  .apos-assistant-image-ask__body {
    display: flex;
    overflow-y: auto;
    flex: 0 1 auto;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
    max-height: 45vh;
    margin: 0 -4px;
    padding: 2px 4px;
  }

  .apos-assistant-image-ask__candidates {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    gap: 6px;
  }

  .apos-assistant-image-ask__candidate {
    position: relative;

    &:hover .apos-assistant-image-ask__zoom,
    &:focus-within .apos-assistant-image-ask__zoom {
      opacity: 1;
    }
  }

  .apos-assistant-image-ask__pick {
    @include apos-button-reset();

    & {
      position: relative;
      display: block;
      box-sizing: border-box;
      width: 100%;
      padding: 3px;
      border: 1px solid var(--a-base-8);
      border-radius: var(--a-border-radius-large);
      background-color: var(--a-background-primary);
      transition: border-color 200ms, box-shadow 200ms;
    }

    &:hover:not(:disabled) {
      border-color: var(--a-base-5);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }

    &:disabled {
      cursor: default;
    }
  }

  .apos-assistant-image-ask__candidate--picked .apos-assistant-image-ask__pick {
    border-color: var(--a-primary);
    box-shadow: 0 0 0 1px var(--a-primary);
  }

  .apos-assistant-image-ask__image {
    display: block;
    width: 100%;
    border-radius: var(--a-border-radius);
    aspect-ratio: 3 / 2;
    object-fit: cover;
    background-color: var(--a-base-9);
  }

  .apos-assistant-image-ask__number {
    position: absolute;
    top: 8px;
    left: 8px;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    color: var(--a-white);
    font-size: var(--a-type-smaller);
    line-height: 1;
    border-radius: 50%;
    background-color: color-mix(in srgb, var(--a-black) 60%, transparent);
    font-variant-numeric: tabular-nums;

    svg {
      width: 14px;
      height: 14px;
    }
  }

  .apos-assistant-image-ask__candidate--picked .apos-assistant-image-ask__number {
    background-color: var(--a-primary);
  }

  .apos-assistant-image-ask__zoom {
    @include apos-button-reset();

    & {
      position: absolute;
      right: 8px;
      bottom: 8px;
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      color: var(--a-white);
      border-radius: var(--a-border-radius);
      background-color: color-mix(in srgb, var(--a-black) 55%, transparent);
      opacity: 0;
      transition: opacity 200ms;
    }

    svg {
      width: 14px;
      height: 14px;
    }

    &:focus-visible {
      outline: 1px solid var(--a-white);
      outline-offset: 1px;
      opacity: 1;
    }
  }

  .apos-assistant-image-ask__replaces {
    @include type-small;

    & {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 2px;
      color: var(--a-base-2);
      line-height: var(--a-line-base);
    }

    svg {
      flex-shrink: 0;
      width: 14px;
      height: 14px;
    }
  }

  .apos-assistant-image-ask__row {
    @include apos-button-reset();
    @include type-base;

    & {
      box-sizing: border-box;
      width: 100%;
      padding: 6px 10px;
      border: 1px solid var(--a-base-7);
      color: var(--a-text-primary);
      text-align: left;
      transition: background-color 200ms, border-color 200ms;
      line-height: var(--a-line-tall);
      border-radius: var(--a-border-radius);
      background-color: var(--a-base-10);
      box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
    }

    &:hover:not(:disabled) {
      border-color: var(--a-base-5);
      background-color: var(--a-base-9);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }

    &:disabled {
      color: var(--a-base-2);
      cursor: default;
      box-shadow: none;
    }
  }

  .apos-assistant-image-ask__row--picked:not(:disabled) {
    border-color: color-mix(in srgb, var(--a-primary) 55%, transparent);
    color: var(--a-primary);
    background-color: color-mix(in srgb, var(--a-primary) 8%, var(--a-background-primary));
  }

  .apos-assistant-image-ask__refine {
    display: flex;
    align-items: center;
    padding: 4px;
    border: 1px solid var(--a-base-7);
    gap: 6px;
    border-radius: var(--a-border-radius);
    background-color: var(--a-base-10);
    transition: border-color 200ms, box-shadow 200ms;

    &:focus-within {
      border-color: color-mix(in srgb, var(--a-primary) 50%, transparent);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--a-primary) 12%, transparent);
    }
  }

  .apos-assistant-image-ask__refine-label {
    flex-shrink: 0;
    padding: 6px 10px;
    border: 1px solid var(--a-base-7);
    color: var(--a-base-1);
    font-size: var(--a-type-small);
    letter-spacing: var(--a-letter-wide);
    line-height: 1;
    text-transform: uppercase;
    border-radius: var(--a-border-radius);
    background-color: var(--a-background-primary);
  }

  .apos-assistant-image-ask__input {
    @include type-base;

    & {
      flex: 1 1 auto;
      min-width: 0;
      padding: 6px 8px;
      border: 1px solid color-mix(in srgb, var(--a-base-7) 60%, transparent);
      color: var(--a-text-primary);
      line-height: var(--a-line-tall);
      border-radius: var(--a-border-radius);
      background-color: var(--a-background-primary);
    }

    &:focus {
      border-color: color-mix(in srgb, var(--a-primary) 50%, transparent);
      outline: none;
    }

    &:disabled {
      opacity: 0.6;
    }
  }

  .apos-assistant-image-ask__send {
    @include apos-button-reset();
    @include type-base;

    & {
      flex-shrink: 0;
      padding: 6px 12px;
      color: var(--a-white);
      line-height: var(--a-line-tall);
      border-radius: var(--a-border-radius);
      background-color: var(--a-primary);
      transition: background-color 200ms, opacity 200ms;
    }

    &:hover:not(:disabled) {
      background-color: var(--a-primary-dark-10);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }

    &:disabled {
      opacity: 0.45;
      cursor: default;
    }
  }
</style>
