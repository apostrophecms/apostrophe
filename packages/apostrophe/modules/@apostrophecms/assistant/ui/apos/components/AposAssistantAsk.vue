<template>
  <AposAssistantDock
    tone="default"
    role="group"
    :label="$t('apostrophe:assistantQuestion')"
    data-apos-test="assistant-ask"
  >
    <template #toolbar>
      <p
        :id="`${id}-label`"
        class="apos-assistant-ask__label"
        :aria-live="single ? null : 'polite'"
        data-apos-test="assistant-ask-label"
      >
        {{ single
          ? questions[0].question
          : $t('apostrophe:assistantQuestionsPosition', {
            current: current + 1,
            total: questions.length
          }) }}
      </p>
    </template>
    <template #aside>
      <button
        type="button"
        class="apos-assistant-ask__skip"
        :disabled="sending"
        data-apos-test="assistant-ask-skip"
        @click="skip"
      >
        {{ $t('apostrophe:assistantSkip') }}
      </button>
    </template>
    <div
      ref="body"
      class="apos-assistant-ask__body"
    >
      <div
        v-for="(entry, index) in questions"
        v-show="index === current"
        :key="index"
        class="apos-assistant-ask__question"
        data-apos-test="assistant-ask-question"
      >
        <p
          v-if="!single"
          :id="`${id}-${index}`"
          class="apos-assistant-ask__text"
        >
          {{ entry.question }}
        </p>
        <div
          class="apos-assistant-ask__options"
          role="radiogroup"
          :aria-labelledby="single ? `${id}-label` : `${id}-${index}`"
        >
          <button
            v-for="(option, choice) in entry.options || []"
            :key="choice"
            type="button"
            class="apos-assistant-ask__option"
            :class="{
              'apos-assistant-ask__option--picked': picks[index]?.choice === choice,
              'apos-assistant-ask__option--described': option.description
            }"
            role="radio"
            :aria-checked="picks[index]?.choice === choice ? 'true' : 'false'"
            :aria-labelledby="`${id}-${index}-${choice}`"
            :aria-describedby="option.description ? `${id}-${index}-${choice}-description` : null"
            :disabled="sending"
            data-apos-test="assistant-ask-option"
            @click="pick(index, { choice })"
          >
            <span
              class="apos-assistant-ask__number"
              aria-hidden="true"
            >{{ choice + 1 }}</span>
            <span class="apos-assistant-ask__option-text">
              <span
                :id="`${id}-${index}-${choice}`"
                class="apos-assistant-ask__option-label"
              >{{ option.label }}</span>
              <span
                v-if="option.description"
                :id="`${id}-${index}-${choice}-description`"
                class="apos-assistant-ask__option-description"
                data-apos-test="assistant-ask-option-description"
              >{{ option.description }}</span>
            </span>
          </button>
          <button
            type="button"
            class="apos-assistant-ask__option apos-assistant-ask__option--decide"
            :class="{ 'apos-assistant-ask__option--picked': picks[index]?.youDecide }"
            role="radio"
            :aria-checked="picks[index]?.youDecide ? 'true' : 'false'"
            :disabled="sending"
            data-apos-test="assistant-ask-decide"
            @click="pick(index, { youDecide: true })"
          >
            <span
              class="apos-assistant-ask__number"
              aria-hidden="true"
            >{{ (entry.options || []).length + 1 }}</span>
            <span class="apos-assistant-ask__option-label">{{ $t('apostrophe:assistantYouDecide') }}</span>
          </button>
          <div
            v-if="takesText(entry)"
            class="apos-assistant-ask__other"
            :class="{
              'apos-assistant-ask__other--active': picks[index]?.text,
              'apos-assistant-ask__other--text': !entry.options
            }"
          >
            <button
              v-if="entry.options"
              type="button"
              class="apos-assistant-ask__option apos-assistant-ask__option--other"
              role="radio"
              :aria-checked="picks[index]?.text ? 'true' : 'false'"
              :disabled="sending"
              data-apos-test="assistant-ask-other"
              @click="pickText(index)"
            >
              <span class="apos-assistant-ask__other-label">{{ $t('apostrophe:assistantOther') }}</span>
            </button>
            <input
              v-model="texts[index]"
              type="text"
              class="apos-assistant-ask__input"
              :aria-label="$t(entry.options ? 'apostrophe:assistantOtherAnswer' : 'apostrophe:assistantYourAnswer')"
              :placeholder="$t('apostrophe:assistantAnswerPlaceholder')"
              :disabled="sending"
              maxlength="2000"
              data-apos-test="assistant-ask-input"
              @input="onText(index)"
              @keydown.enter.prevent="onEnter(index, $event)"
            >
            <button
              v-if="single"
              type="button"
              class="apos-assistant-ask__send"
              :disabled="sending || !complete"
              data-apos-test="assistant-ask-send"
              @click="submit"
            >
              {{ $t('apostrophe:assistantSend') }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="!single"
      class="apos-assistant-ask__footer"
    >
      <div class="apos-assistant-ask__nav">
        <AposButton
          ref="previousButton"
          type="outline"
          icon="chevron-left-icon"
          icon-only
          label="apostrophe:assistantPreviousQuestion"
          tooltip="apostrophe:assistantPreviousQuestion"
          :modifiers="[ 'small' ]"
          :disabled="sending || current === 0"
          :attrs="{ 'data-apos-test': 'assistant-ask-previous' }"
          @click="step(-1)"
        />
        <AposButton
          ref="nextButton"
          type="outline"
          icon="chevron-right-icon"
          icon-only
          label="apostrophe:assistantNextQuestion"
          tooltip="apostrophe:assistantNextQuestion"
          :modifiers="[ 'small' ]"
          :disabled="sending || current === questions.length - 1"
          :attrs="{ 'data-apos-test': 'assistant-ask-next' }"
          @click="step(1)"
        />
      </div>
      <button
        ref="sendButton"
        type="button"
        class="apos-assistant-ask__send"
        :disabled="sending || !complete"
        data-apos-test="assistant-ask-send"
        @click="submit"
      >
        {{ $t('apostrophe:assistantSendAnswers') }}
      </button>
    </div>
  </AposAssistantDock>
</template>

<script setup>
import {
  computed, nextTick, ref, watch
} from 'vue';
import { createId } from 'apostrophe/lib/beneath.js';
import { useAssistantStore } from '../stores/assistant.js';

// The questions of a waiting request, in the dock above the composer: each
// one answered with an option, the editor's own words where it takes them,
// or "You decide". A single question goes as soon as it is answered. Several
// show one at a time: an answer moves on to the next unanswered one, the
// chevrons move freely, and Send answers sends them together once all are
// answered. The questions and options are the model's words, shown as text
// and never translated
const props = defineProps({
  chatId: {
    type: String,
    required: true
  },
  // The stored ask: `{ callId, payload: { questions } }`
  ask: {
    type: Object,
    required: true
  }
});

const store = useAssistantStore();
const id = `apos-assistant-ask-${createId()}`;
const body = ref(null);
const previousButton = ref(null);
const nextButton = ref(null);
const sendButton = ref(null);
const questions = computed(() => props.ask.payload.questions);
const single = computed(() => questions.value.length === 1);
const current = ref(0);
// Per question: `{ choice }`, `{ text: true }` or `{ youDecide: true }`
const picks = ref([]);
const texts = ref([]);
const sending = ref(false);

watch(() => props.ask.callId, () => {
  picks.value = questions.value.map(() => null);
  texts.value = questions.value.map(() => '');
  current.value = 0;
  sending.value = false;
}, { immediate: true });

const answers = computed(() => questions.value.map((entry, index) => {
  const picked = picks.value[index];
  if (!picked) {
    return null;
  }
  if (picked.text) {
    const text = (texts.value[index] || '').trim();
    return text ? { text } : null;
  }
  return picked;
}));
const complete = computed(() => answers.value.every(Boolean));

function takesText(entry) {
  return !entry.options || entry.other;
}

function questionElement(index) {
  return body.value?.querySelectorAll('[data-apos-test="assistant-ask-question"]')[index];
}

function pick(index, value) {
  picks.value[index] = value;
  if (single.value) {
    submit();
    return;
  }
  advance(index);
}

async function pickText(index) {
  picks.value[index] = { text: true };
  await nextTick();
  questionElement(index)?.querySelector('input')?.focus();
}

function onText(index) {
  picks.value[index] = (texts.value[index] || '').trim()
    ? { text: true }
    : (picks.value[index]?.text ? null : picks.value[index]);
}

function onEnter(index, event) {
  if (event.isComposing) {
    return;
  }
  if (single.value) {
    submit();
    return;
  }
  if (answers.value[index]) {
    advance(index);
  }
}

// After an answer: the next question still unanswered, else Send answers
async function advance(from) {
  const count = questions.value.length;
  const next = [ ...Array(count - 1).keys() ]
    .map(offset => (from + 1 + offset) % count)
    .find(index => !answers.value[index]);
  if (next === undefined) {
    await nextTick();
    sendButton.value?.focus();
    return;
  }
  current.value = next;
  await nextTick();
  // Its first option, or the field of a question answered in words
  questionElement(next)?.querySelector([
    '[data-apos-test="assistant-ask-option"]:not(:disabled)',
    'input:not(:disabled)'
  ].join(', '))?.focus();
}

// The chevrons keep the focus; at either end it passes to the other one
async function step(offset) {
  const last = questions.value.length - 1;
  current.value = Math.min(Math.max(current.value + offset, 0), last);
  await nextTick();
  if (current.value === (offset < 0 ? 0 : last)) {
    const other = offset < 0 ? nextButton.value : previousButton.value;
    other?.$el?.querySelector('button')?.focus();
  }
}

async function submit() {
  if (sending.value || !complete.value) {
    return;
  }
  sending.value = true;
  const taken = await store.answer(props.chatId, props.ask.callId, {
    answers: answers.value
  });
  if (!taken) {
    sending.value = false;
  }
}

async function skip() {
  sending.value = true;
  await store.skip(props.chatId);
}
</script>

<style lang="scss" scoped>
  .apos-assistant-ask__label {
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

  .apos-assistant-ask__skip {
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

  // A question that outgrows the panel scrolls inside the dock, so the
  // composer stays in view; the padding keeps focus rings and shadows clear
  // of the edge
  .apos-assistant-ask__body {
    overflow-y: auto;
    flex: 0 1 auto;
    min-height: 0;
    max-height: 45vh;
    margin: 0 -4px;
    padding: 2px 4px;
  }

  .apos-assistant-ask__question {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .apos-assistant-ask__text {
    @include type-base;

    & {
      margin: 0;
      color: var(--a-text-primary);
      font-weight: var(--a-weight-bold);
      line-height: var(--a-line-tall);
    }
  }

  .apos-assistant-ask__options {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .apos-assistant-ask__option {
    @include apos-button-reset();
    @include type-base;

    & {
      display: flex;
      box-sizing: border-box;
      align-items: center;
      width: 100%;
      padding: 6px 10px 6px 7px;
      border: 1px solid var(--a-base-7);
      color: var(--a-text-primary);
      text-align: left;
      transition: background-color 200ms, border-color 200ms, box-shadow 200ms;
      line-height: var(--a-line-tall);
      gap: 10px;
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
      opacity: 0.6;
      cursor: default;
      box-shadow: none;
    }
  }

  .apos-assistant-ask__option--picked {
    border-color: color-mix(in srgb, var(--a-primary) 55%, transparent);
    color: var(--a-primary);
    background-color: color-mix(in srgb, var(--a-primary) 8%, var(--a-background-primary));

    .apos-assistant-ask__number {
      border-color: var(--a-primary);
      color: var(--a-white);
      background-color: var(--a-primary);
    }
  }

  // The number sits on the first line of a described option
  .apos-assistant-ask__option--described {
    align-items: flex-start;

    .apos-assistant-ask__number {
      margin-top: calc((var(--a-type-base) * var(--a-line-tall) - 20px) / 2);
    }
  }

  .apos-assistant-ask__option--decide:not(.apos-assistant-ask__option--picked) {
    color: var(--a-base-1);
  }

  .apos-assistant-ask__option--other {
    flex-shrink: 0;
    width: auto;
    padding: 6px 10px;
    background-color: var(--a-background-primary);
  }

  .apos-assistant-ask__number {
    display: inline-grid;
    box-sizing: border-box;
    flex-shrink: 0;
    height: 20px;
    padding: 0 5px;
    border: 1px solid var(--a-base-8);
    color: var(--a-base-2);
    font-size: var(--a-type-smaller);
    place-items: center;
    min-width: 20px;
    line-height: 1;
    border-radius: 4px;
    background-color: var(--a-background-primary);
    font-variant-numeric: tabular-nums;
  }

  .apos-assistant-ask__other-label {
    color: var(--a-base-1);
    font-size: var(--a-type-small);
    letter-spacing: var(--a-letter-wide);
    line-height: 1;
    text-transform: uppercase;
  }

  .apos-assistant-ask__option-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 2px;
  }

  .apos-assistant-ask__option-label {
    min-width: 0;
  }

  .apos-assistant-ask__option-description {
    color: var(--a-base-1);
  }

  .apos-assistant-ask__other {
    display: flex;
    align-items: center;
    padding: 4px;
    border: 1px solid var(--a-base-7);
    gap: 6px;
    border-radius: var(--a-border-radius);
    background-color: var(--a-base-10);
    transition: border-color 200ms, box-shadow 200ms;

    &:focus-within,
    &.apos-assistant-ask__other--active {
      border-color: color-mix(in srgb, var(--a-primary) 50%, transparent);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--a-primary) 12%, transparent);
    }
  }

  .apos-assistant-ask__input {
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

  .apos-assistant-ask__other--text .apos-assistant-ask__input {
    padding: 8px 10px;
  }

  .apos-assistant-ask__send {
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

  .apos-assistant-ask__footer {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    margin-top: 10px;
    gap: 10px;
  }

  // See Changes' navigator buttons: light on the dock, a disabled one fades.
  // Squares as tall as Send answers, so the footer keeps the dock's rhythm
  .apos-assistant-ask__nav {
    display: flex;
    gap: 5px;

    :deep(.apos-button) {
      display: inline-flex;
      box-sizing: border-box;
      align-items: center;
      justify-content: center;
      width: calc(var(--a-type-base) * var(--a-line-tall) + 12px);
      height: calc(var(--a-type-base) * var(--a-line-tall) + 12px);
      padding: 0;
      border-color: var(--a-base-8);
      color: var(--a-base-1);
      background-color: var(--a-background-primary);

      &:hover:not([disabled]) {
        color: var(--a-text-primary);
        background-color: var(--a-base-10);
      }

      &[disabled] {
        border-color: var(--a-base-9);
        color: var(--a-base-6);
        background-color: transparent;
      }
    }
  }
</style>
