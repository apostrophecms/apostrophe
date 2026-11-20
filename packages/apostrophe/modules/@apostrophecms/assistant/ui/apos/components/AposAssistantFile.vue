<template>
  <div
    class="apos-assistant-file"
    :class="{
      'apos-assistant-file--picture': asPicture && !isGone,
      'apos-assistant-file--uploading': uploading,
      'apos-assistant-file--gone': isGone
    }"
    :aria-busy="uploading ? 'true' : null"
    :title="isGone ? null : name"
    data-apos-test="assistant-file"
    :data-apos-state="isGone ? 'gone' : (uploading ? 'uploading' : 'ready')"
  >
    <span
      v-if="isGone"
      class="apos-assistant-file__chip"
      role="img"
      :aria-label="$t('apostrophe:assistantFileGoneLabel', { name })"
    >
      <svg
        class="apos-assistant-file__glyph"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          :d="FILE_PATH"
        />
        <path
          d="M3 3L21 21"
          stroke="currentColor"
          stroke-width="2"
        />
      </svg>
      <span
        class="apos-assistant-file__lines"
        aria-hidden="true"
      >
        <span class="apos-assistant-file__name">{{ shortName }}</span>
        <span class="apos-assistant-file__meta">{{ $t('apostrophe:assistantFileGone') }}</span>
      </span>
    </span>
    <component
      :is="opener"
      v-else
      class="apos-assistant-file__body"
      :class="{ 'apos-assistant-file__body--action': opener !== 'span' }"
      v-bind="openerAttrs"
      @click="onOpen"
    >
      <img
        v-if="asPicture"
        class="apos-assistant-file__image"
        :src="src"
        alt=""
        @error="broken = true"
      >
      <span
        v-else
        class="apos-assistant-file__chip"
      >
        <AposAssistantThinking v-if="uploading" />
        <svg
          v-else
          class="apos-assistant-file__glyph"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            :d="FILE_PATH"
          />
        </svg>
        <span class="apos-assistant-file__lines">
          <span class="apos-assistant-file__name">{{ shortName }}</span>
          <span class="apos-assistant-file__meta">{{ meta }}</span>
        </span>
      </span>
      <span
        v-if="uploading && asPicture"
        class="apos-assistant-file__busy"
      >
        <AposAssistantThinking />
      </span>
    </component>
    <button
      v-if="removable"
      type="button"
      class="apos-assistant-file__remove"
      :aria-label="$t('apostrophe:assistantFileRemove', { name })"
      :title="$t('apostrophe:assistantFileRemove', { name })"
      data-apos-test="assistant-file-remove"
      @click="emit('remove')"
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
      </svg>
    </button>
  </div>
</template>

<script setup>
import {
  computed, inject, ref, watch
} from 'vue';
import {
  isPicture, getFormat, formatSize
} from '../lib/attachments.js';

// One file of a request: an image's thumbnail, any other file's chip with
// its name and format, dimmed while it uploads, or a grey tile once it is
// no longer available. In the composer it has a ×; in a sent message an
// image opens (`open`) and any other file downloads through `href`
const FILE_PATH = 'M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z';
// The characters a chip's name shows, its end kept so the extension shows
const NAME_MAX = 22;

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    default: 0
  },
  // The thumbnail of an image
  src: {
    type: String,
    default: null
  },
  // Shown as a picture whatever its name says: an image named by its title
  picture: {
    type: Boolean,
    default: null
  },
  uploading: {
    type: Boolean,
    default: false
  },
  gone: {
    type: Boolean,
    default: false
  },
  removable: {
    type: Boolean,
    default: false
  },
  // A sent image opens on a click
  openable: {
    type: Boolean,
    default: false
  },
  // A sent file downloads from here
  href: {
    type: String,
    default: null
  }
});
const emit = defineEmits([ 'remove', 'open' ]);
const $t = inject('i18n');

// A thumbnail the server no longer has: the file is gone from storage
const broken = ref(false);
watch(() => props.src, () => {
  broken.value = false;
});
const isGone = computed(() => props.gone || broken.value);
const asPicture = computed(() => (props.picture ?? isPicture(props.name)) &&
  Boolean(props.src));
const meta = computed(() => [ getFormat(props.name), formatSize(props.size) ]
  .filter(Boolean)
  .join(' · '));
const shortName = computed(() => {
  const { name } = props;
  if (name.length <= NAME_MAX) {
    return name;
  }
  const tail = Math.min(10, Math.floor(NAME_MAX / 2));
  return `${name.slice(0, NAME_MAX - tail - 1)}…${name.slice(-tail)}`;
});
const opener = computed(() => {
  if (props.uploading) {
    return 'span';
  }
  if (asPicture.value && props.openable) {
    return 'button';
  }
  return (!asPicture.value && props.href) ? 'a' : 'span';
});
const openerAttrs = computed(() => {
  if (opener.value === 'button') {
    return {
      type: 'button',
      'aria-label': $t('apostrophe:assistantFileOpen', { name: props.name }),
      'data-apos-test': 'assistant-file-open'
    };
  }
  if (opener.value === 'a') {
    // Named by its visible text, the verb its description
    return {
      href: props.href,
      download: props.name,
      title: $t('apostrophe:assistantFileDownload', { name: props.name }),
      'data-apos-test': 'assistant-file-download'
    };
  }
  return asPicture.value
    ? {
      role: 'img',
      'aria-label': props.name
    }
    : {};
});

function onOpen() {
  if (opener.value === 'button') {
    emit('open');
  }
}
</script>

<style lang="scss" scoped>
  .apos-assistant-file {
    position: relative;
    flex-shrink: 0;
    max-width: 100%;
  }

  .apos-assistant-file__body {
    @include apos-button-reset();

    & {
      position: relative;
      display: block;
      color: inherit;
      text-decoration: none;
      border-radius: var(--a-border-radius);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }
  }

  .apos-assistant-file__body--action {
    cursor: pointer;
  }

  .apos-assistant-file__image {
    display: block;
    width: 48px;
    height: 48px;
    border: 1px solid var(--a-base-9);
    border-radius: var(--a-border-radius);
    object-fit: cover;
    background-color: var(--a-base-10);
  }

  .apos-assistant-file__chip {
    display: flex;
    box-sizing: border-box;
    align-items: center;
    gap: 8px;
    max-width: 200px;
    height: 48px;
    padding: 0 10px;
    border: 1px solid var(--a-base-9);
    border-radius: var(--a-border-radius);
    background-color: var(--a-base-10);
  }

  .apos-assistant-file__body--action:hover .apos-assistant-file__chip {
    border-color: var(--a-base-7);
  }

  .apos-assistant-file__glyph {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    color: var(--a-base-3);
  }

  .apos-assistant-file__lines {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .apos-assistant-file__name,
  .apos-assistant-file__meta {
    overflow: hidden;
    font-size: var(--a-type-small);
    line-height: var(--a-line-base);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .apos-assistant-file__name {
    color: var(--a-text-primary);
  }

  .apos-assistant-file__meta {
    color: var(--a-base-2);
  }

  // A chip keeps its text readable: the thinking mark in place of its
  // glyph says it uploads
  .apos-assistant-file--uploading .apos-assistant-file__image {
    opacity: 0.5;
  }

  .apos-assistant-file__busy {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }

  .apos-assistant-file--gone .apos-assistant-file__chip {
    border-color: var(--a-base-8);
    background-color: var(--a-base-9);
  }

  // Darker than a live chip's muted line, to read at 4.5:1 on the grey
  .apos-assistant-file--gone .apos-assistant-file__name,
  .apos-assistant-file--gone .apos-assistant-file__meta,
  .apos-assistant-file--gone .apos-assistant-file__glyph {
    color: var(--a-base-1);
  }

  .apos-assistant-file__remove {
    @include apos-button-reset();

    & {
      position: absolute;
      top: -6px;
      right: -6px;
      display: grid;
      place-items: center;
      width: 18px;
      height: 18px;
      border: 1px solid var(--a-base-8);
      border-radius: 50%;
      color: var(--a-base-1);
      background-color: var(--a-background-primary);
      box-shadow: var(--a-box-shadow);
      opacity: 0;
      transition: opacity 200ms;
    }

    svg {
      width: 12px;
      height: 12px;
    }

    &:hover {
      color: var(--a-primary);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 1px;
    }
  }

  // As the prototype: shown on hover, and on keyboard focus
  .apos-assistant-file:hover .apos-assistant-file__remove,
  .apos-assistant-file:focus-within .apos-assistant-file__remove {
    opacity: 1;
  }
</style>
