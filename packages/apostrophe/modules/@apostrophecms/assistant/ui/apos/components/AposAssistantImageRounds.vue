<template>
  <template
    v-for="ask in asks"
    :key="ask.callId"
  >
    <div
      v-for="(round, index) in ask.refined"
      :key="index"
      class="apos-assistant-image-rounds__refined"
      data-apos-test="assistant-image-refined"
    >
      <AposAssistantFiles
        v-if="round.kept"
        :files="[ round.kept ]"
      />
      <p class="apos-assistant-image-rounds__notes">
        {{ round.notes }}
      </p>
    </div>
    <figure
      v-if="ask.image"
      class="apos-assistant-image-rounds__result"
      data-apos-test="assistant-image-result"
      :data-apos-outcome="getOutcome(ask.outcome)"
    >
      <AposAssistantFile
        v-if="ask.image.gone"
        :name="ask.title"
        gone
      />
      <button
        v-else
        type="button"
        class="apos-assistant-image-rounds__open"
        :aria-label="$t('aposAssistant:assistantFileOpen', { name: ask.title })"
        :disabled="!ask.image.src"
        data-apos-test="assistant-image-result-open"
        @click="zoom(ask.image, ask.title)"
      >
        <img
          v-if="ask.image.src"
          class="apos-assistant-image-rounds__image"
          :src="ask.image.src"
          alt=""
          loading="lazy"
          decoding="async"
        >
        <span
          v-else
          class="apos-assistant-image-rounds__placeholder"
        />
      </button>
      <figcaption class="apos-assistant-image-rounds__caption">
        {{ $t((getOutcome(ask.outcome) === 'kept')
          ? 'aposAssistant:assistantPickedOption'
          : 'aposAssistant:assistantUsedOption', {
          number: ask.outcome.option
        }) }}
      </figcaption>
    </figure>
    <AposAssistantActivity
      v-if="ask.outcome?.action === 'cancel'"
      tone="general"
      :title="$t('aposAssistant:assistantImagesCancelled')"
      :text="$t('aposAssistant:assistantNothingSaved')"
      data-apos-test="assistant-image-cancelled"
    />
  </template>
</template>

<script setup>
import { computed } from 'vue';
import AposAssistantFile from './AposAssistantFile.vue';
import AposAssistantFiles from './AposAssistantFiles.vue';
import { getFileUrl } from '../lib/attachments.js';
import { getMediaImage } from '../lib/media-images.js';

// What stays of a request's image asks once a round resolves: the editor's
// notes for each Refine beside the image kept for it, and the image that
// stands, read from Media once used, or the one picked and kept in the chat
// when Media didn't take it ("Not saved to Media" says why, with Retry).
// "Cancelled" when nothing was saved. The other candidates are gone
const props = defineProps({
  request: {
    type: Object,
    required: true
  }
});

const asks = computed(() => {
  const { chatId, unavailable = [] } = props.request;
  const chatImage = (_id) => ({
    gone: unavailable.includes(_id),
    src: getFileUrl(chatId, _id, 'thumbnail'),
    large: getFileUrl(chatId, _id, 'preview')
  });
  return (props.request.imageAsks || []).map(ask => ({
    ...ask,
    refined: ask.rounds
      .filter(round => round.action === 'refine')
      .map(round => ({
        notes: round.notes,
        kept: round.kept && {
          key: round.kept,
          name: ask.title,
          picture: true,
          ...chatImage(round.kept)
        }
      })),
    image: getResult(ask.outcome, chatImage)
  }));
});

function getResult(outcome, chatImage) {
  if (outcome?.action !== 'use') {
    return null;
  }
  if (outcome.imageId) {
    const media = getMediaImage(outcome.imageId);
    return {
      gone: media.status === 'gone',
      src: media.url || null,
      large: media.large || null
    };
  }
  // Kept in the chat when Media didn't take it; the pick itself at the
  // click, until the server says which
  const kept = outcome.attachmentId || outcome.candidate;
  return kept ? chatImage(kept) : null;
}

// `saved` in Media, `kept` in the chat, `saving` from the click on
function getOutcome(outcome) {
  if (outcome.imageId) {
    return 'saved';
  }
  return outcome.attachmentId ? 'kept' : 'saving';
}

function zoom(image, title) {
  apos.modal.execute('AposAssistantLightbox', {
    src: image.large,
    alt: title
  });
}
</script>

<style lang="scss" scoped>
  // The editor's own words, as their message shows
  .apos-assistant-image-rounds__refined {
    @include type-label;

    & {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px 10px;
      border: 1px solid color-mix(in srgb, var(--a-primary) 25%, transparent);
      border-radius: var(--a-border-radius-large);
      background-color: var(--a-background-primary);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
  }

  .apos-assistant-image-rounds__notes {
    margin: 0;
    white-space: pre-wrap;
  }

  .apos-assistant-image-rounds__result {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    margin: 0;
  }

  .apos-assistant-image-rounds__open {
    @include apos-button-reset();

    & {
      display: block;
      padding: 3px;
      border: 1px solid var(--a-base-8);
      border-radius: var(--a-border-radius-large);
      background-color: var(--a-background-primary);
      cursor: zoom-in;
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }

    &:disabled {
      cursor: default;
    }
  }

  .apos-assistant-image-rounds__image,
  .apos-assistant-image-rounds__placeholder {
    display: block;
    width: 200px;
    max-width: 100%;
    border-radius: var(--a-border-radius);
    aspect-ratio: 3 / 2;
    object-fit: cover;
    background-color: var(--a-base-9);
  }

  .apos-assistant-image-rounds__caption {
    color: var(--a-base-2);
    font-size: var(--a-type-small);
  }
</style>
