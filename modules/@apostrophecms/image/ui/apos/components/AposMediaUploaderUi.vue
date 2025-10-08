<template>
  <div
    ref="mediaUploaderEl"
    class="apos-media-uploader"
    :style="uploaderStyle"
    :class="{
      'apos-media-uploader--disabled': props.disabled,
      'apos-is-dragging': dragging,
      'apos-is-dragging--over': dragover,
      'apos-has-placeholder': hasPlaceholder
    }"
    @drop.prevent="uploadMedia"
    @dragover.prevent=""
    @dragenter="dragOverEnter"
    @dragleave="dragOverLeave"
  >
    <div class="apos-media-uploader__inner">
      <!-- if we want animations.. -->
      <!-- <AposImagePlusIcon class="apos-media-uploader__icon" /> -->
      <AposIndicator
        class="apos-media-uploader__icon"
        :icon-size="70"
        :icon="props.icon"
      />
      <!-- eslint-disable vue/no-v-html -->
      <p
        class="apos-media-uploader__instructions"
        v-html="instructionsTranslation"
      />
      <!-- eslint-disable vue/no-v-html -->
      <p
        class="apos-media-uploader__infos"
        v-html="acceptTranslation"
      />
      <p
        v-if="props.minSize"
        class="apos-media-uploader__infos"
      >
        {{ minSizeTranslation }}
      </p>
    </div>
    <input
      ref="uploadEl"
      type="file"
      class="apos-sr-only"
      :accept="props.accept"
      multiple="true"
      :disabled="props.disabled"
      tabindex="-1"
      @input="uploadMedia"
      @click.stop
    >
  </div>
</template>

<script setup>
import {
  ref, inject, useTemplateRef, onMounted, onUnmounted, computed, onBeforeUnmount
} from 'vue';
import { computeMinSizes } from 'apostrophe/lib/image.js';

const $t = inject('i18n');
const props = defineProps({
  icon: {
    type: String,
    default: 'image-icon'
  },
  diabled: {
    type: Boolean,
    default: false
  },
  minSize: {
    type: Array,
    default: null
  },
  aspectRatio: {
    type: Array,
    default: null
  },
  accept: {
    type: String,
    default: 'gif,.jpg,.png,.svg,.webp,.jpeg'
  },
  placeholder: {
    type: String,
    default: null
  }
});
const emit = defineEmits([ 'media', 'upload' ]);
const mediaUploaderEl = useTemplateRef('mediaUploaderEl');
const uploadEl = useTemplateRef('uploadEl');
const dragOverCounter = ref(0);
const dragCounter = ref(0);

const mediaLibraryTranslation = $t('apostrophe:mediaLibrary');
const yourDeviceTranslation = $t('apostrophe:yourDevice');
const instructionsTranslation = $t('apostrophe:imageUploadMsg', {
  mediaLibrary: `<button class="apos-media-uploader__btn" data-apos-click="openMedia">${mediaLibraryTranslation}</button>`,
  yourDevice: `<button class="apos-media-uploader__btn" data-apos-click="searchFile">${yourDeviceTranslation}</button>`
});

let minSizeTranslation;

if (props.minSize) {
  const { minWidth, minHeight } = computeMinSizes(
    props.minSize,
    props.aspectRatio
  );

  minSizeTranslation = $t('apostrophe:minimumSize', {
    width: Math.round(minWidth),
    height: Math.round(minHeight)
  });
} else {
  minSizeTranslation = $t('apostrophe:minimumSize', {
    width: '-',
    height: '-'
  });
}

const formattedAccept = props.accept
  .replace(/\s+|\.+/g, '')
  .split(',')
  .map((format) => format.trim().toUpperCase());
const formats = formattedAccept
  .slice(0, formattedAccept.length - 1)
  .map((format) => `<strong>${format}</strong>`)
  .join(', ');
const maxSize = getMaxSize();
const acceptTranslation = $t('apostrophe:imageUploadSupport', {
  formats,
  last: `<strong>${formattedAccept[formattedAccept.length - 1]}</strong>`,
  upTo: maxSize ? ' ' + $t('apostrophe:imageUploadUpTo', { maxSize }) : ''
});

const dragging = computed(() => {
  return dragCounter.value > 0;
});

const dragover = computed(() => {
  return dragOverCounter.value > 0;
});

const hasPlaceholder = computed(() => {
  return Boolean(props.placeholder);
});

const uploaderStyle = computed(() => {
  if (!props.placeholder) {
    return {};
  }

  return {
    'background-image': `url(${props.placeholder})`
  };
});

/**
 * @returns {String} - Formatted string containing configured maximum size
 */
function getMaxSize() {
  const maxSize = apos.modules['@apostrophecms/attachment']?.maxSize;
  if (typeof maxSize === 'number') {
    const num = (maxSize / (1024 * 1024)).toFixed(1).toString();
    return `<strong>${num}MB</strong>`;
  }
  if (typeof maxSize !== 'string') {
    return null;
  }
  const maxSizeStr = maxSize.toLowerCase();
  return `<strong>${maxSizeStr.trim()}</strong>`;
}

/**
 * Increment drag counter when leaving document
 * @param {DragEvent} e
 */
function dragEnterListener(e) {
  if (e.dataTransfer?.types.includes('Files')) {
    dragCounter.value++;
  }
}

/**
 * Decrement drag counter when leaving document
 * @param {DragEvent} e
 */
function dragLeaveListener(e) {
  if (e.dataTransfer?.types.includes('Files')) {
    dragCounter.value--;
  }
}

/** Reset drag counter when dropping */
function dropListener() {
  dragCounter.value = 0;
}

/** Increment drag over counter when entering a drop zone */
function dragOverEnter() {
  dragOverCounter.value++;
}

/** Decrement drag over counter when leaving a drop zone */
function dragOverLeave() {
  dragOverCounter.value--;
}

onMounted(() => {
  bindEmits();
  document.addEventListener('dragenter', dragEnterListener);
  document.addEventListener('dragleave', dragLeaveListener);
  document.addEventListener('drop', dropListener);
});

onBeforeUnmount(() => {
  unbindEmits();
});

onUnmounted(() => {
  document.removeEventListener('dragenter', dragEnterListener);
  document.removeEventListener('dragleave', dragLeaveListener);
  document.removeEventListener('drop', dropListener);
});

/** Bind click events on links contained in translated texts */
function bindEmits() {
  mediaUploaderEl.value.querySelectorAll('[data-apos-click]').forEach((el) => {
    el.addEventListener('click', btnClickEvent);
  });
}

/** Unbind click events on links contained in translated texts */
function unbindEmits() {
  mediaUploaderEl.value.querySelectorAll('[data-apos-click]').forEach((el) => {
    el.removeEventListener('click', btnClickEvent);
  });
}

/** Bind each button event */
function btnClickEvent(event) {
  event.stopPropagation();
  const action = event.currentTarget.getAttribute('data-apos-click');
  if (action === 'openMedia') {
    openMedia();
  } else if (action === 'searchFile') {
    searchFile();
  }
};

function openMedia() {
  emit('media');
}

/** Used to open the user file system */
function searchFile() {
  if (props.disabled) {
    return;
  }
  uploadEl.value.click();
}

/**
 * @param {DragEvent} event - Dropped file event
 */
async function uploadMedia (event) {
  // Reset drag over counter when dropping file
  dragOverCounter.value = 0;
  const files = event.dataTransfer ? event.dataTransfer.files : event.target.files;
  if (!props.accept) {
    emit('upload', files);
    return;
  }

  const hasNoValidFile = [ ...files ].find((file) => {
    const ext = file.name.split('.').pop();
    return !props.accept.includes(ext);
  });

  if (hasNoValidFile) {
    apos.notify('apostrophe:invalid', {
      type: 'danger',
      icon: 'alert-circle-icon',
      dismiss: true
    });
    return;
  }
  emit('upload', files);
}
</script>
<style>
  .apos-is-highlighted .apos-media-uploader {
    /* stylelint-disable-next-line declaration-no-important */
    outline-color: transparent !important;
  }
</style>
<style lang="scss" scoped>
.apos-media-uploader {
  @include apos-button-reset();

  & {
    position: relative;
    display: flex;
    overflow: hidden;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    border-radius: var(--a-border-radius);
    outline: 1px dashed var(--a-base-5);
    color: inherit;
    font-family: var(--a-family-default);
    grid-column: 1 / 3;
    grid-row: 1 / 3;
    min-height: 350px;
    background-color: var(--a-base-10);
    background-size: cover;
  }

  &::before {
    content: '';
    z-index: $z-index-base;
    position: absolute;
    inset: 0;
    background: rgba(255 255 255 / 70%);
  }

  &.apos-is-dragging {
    outline: 1px solid var(--a-primary);
    box-shadow: 0 0 0 3px var(--a-primary-transparent-50);
  }

  &.apos-is-dragging--over {
    background-color: var(--a-white);

    &::before {
      background-color: var(--a-primary-transparent-05);
    }
  }

  &.apos-has-placeholder {
    &.apos-is-dragging--over::before {
     background-color: var(--a-primary-transparent-25);
    }
  }
}

.apos-media-uploader__inner {
  &::after {
    @include apos-transition($duration: 0.3s);

    & {
      z-index: $z-index-under;
      position: absolute;
      content: '';
      width: 90%;
      height: 90%;
    }
  }
}

.apos-media-uploader__inner {
  z-index: $z-index-default;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 20px;
}

.apos-media-uploader__icon {
  @include apos-transition($duration: 0.2s);

  :deep(svg) {
    fill: var(--a-base-7);
  }
}

.apos-media-uploader__instructions {
  margin: 10px 0 15px;
  font-size: var(--a-type-heading);
  max-width: 360px;
  text-align: center;
}

:deep(.apos-media-uploader__btn) {
  @include apos-button-reset();

  & {
    all: unset;
    color: var(--a-primary);
    font-weight: var(--a-weight-light);
    text-decoration: underline;
  }

  &:hover {
    cursor: pointer;
  }
}

.apos-media-uploader__infos {
  margin: 0 0 10px;
  color: var(--a-background-inverted);
  font-size: var(--a-type-large);
}
</style>
