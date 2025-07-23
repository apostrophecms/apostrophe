<template>
  <label
    ref="mediaUploaderEl"
    class="apos-media-uploader"
    :class="{
      'apos-media-uploader--disabled': props.disabled,
      'apos-is-dragging': dragging,
      'apos-is-dragging--over': dragover
    }"
    @drop.prevent="uploadMedia"
    @dragover.prevent=""
    @dragenter="draftOverEnter"
    @dragleave="dragOverLeave"
    @drop="dragOverLeave"
  >
    <div class="apos-media-uploader__inner">
      <!-- if we want animations.. -->
      <!-- <AposImagePlusIcon class="apos-media-uploader__icon" /> -->
      <AposIndicator
        class="apos-media-uploader__icon"
        :icon-size="70"
        :icon="props.icon"
      />
      <p
        class="apos-media-uploader__instructions"
        v-html="instructionsTranslation"
      />
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
    >
  </label>
</template>

<script setup>
import {
  ref, inject, useTemplateRef, onMounted, onUnmounted, computed
} from 'vue';

const $t = inject('i18n');
const props = defineProps({
  icon: {
    type: String,
    default: 'image-plus-icon'
  },
  diabled: {
    type: Boolean,
    default: false
  },
  minSize: {
    type: Array,
    default: null
  },
  accept: {
    type: String,
    default: 'gif,.jpg,.png,.svg,.webp,.jpeg'
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
const minSizeTranslation = props.minSize && $t('apostrophe:minimumSize', {
  width: props.minSize[0] || '_',
  height: props.minSize[1] || '_'
});
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

function getMaxSize() {
  const maxSize = apos.modules['@apostrophecms/asset'].maxSize;
  if (typeof maxSize === 'number') {
    const num = (maxSize / (1024 * 1024)).toFixed(1).toString();
    return `${num}mb`;
  }
  if (typeof maxSize !== 'string') {
    return null;
  }
  const maxSizeStr = maxSize.toLowerCase();
  return maxSizeStr.trim();
}
function dragEnterListener(e) {
  if (e.dataTransfer?.types.includes('Files')) {
    dragCounter.value++;
  }
}

function dragLeaveListener(e) {
  if (e.dataTransfer?.types.includes('Files')) {
    dragCounter.value--;
  }
}

function dropListener() {
  dragCounter.value = 0;
}

function draftOverEnter() {
  dragOverCounter.value++;
}

function dragOverLeave() {
  dragOverCounter.value--;
}

onMounted(() => {
  bindEmits();
  document.addEventListener('dragenter', dragEnterListener);
  document.addEventListener('dragleave', dragLeaveListener);
  document.addEventListener('drop', dropListener);
});

onUnmounted(() => {
  document.removeEventListener('dragenter', dragEnterListener);
  document.removeEventListener('dragleave', dragLeaveListener);
  document.removeEventListener('drop', dropListener);
});

function bindEmits() {
  mediaUploaderEl.value.querySelectorAll('[data-apos-click]').forEach((el) => {
    el.addEventListener('click', (event) => {
      const action = event.currentTarget.getAttribute('data-apos-click');
      if (action === 'openMedia') {
        openMedia();
      } else if (action === 'searchFile') {
        searchFile();
      }
    });
  });
}

function openMedia() {
  emit('media');
}

function searchFile() {
  if (props.disabled) {
    return;
  }
  uploadEl.value.click();
}

async function uploadMedia (event) {
  // Set `dragover` in case the media was dropped.
  dragover.value = false;
  const files = event.dataTransfer ? event.dataTransfer.files : event.target.files;

  emit('upload', files);
}
</script>

<style lang="scss" scoped>
.apos-media-uploader {
  @include apos-button-reset();

  & {
    display: flex;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    border: 1px dashed var(--a-base-3);
    color: inherit;
    grid-column: 1 / 3;
    grid-row: 1 / 3;
    border-radius: 16px;
    background-color: var(--a-base-9);
  }

  &.apos-is-dragging {
    border: 1px solid var(--a-primary);
    box-shadow: 0 0 0 3px var(--a-primary-transparent-50),
  }

  &.apos-is-dragging--over {
    background-color: var(--a-primary-transparent-05);
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
    fill: var(--a-base-8);
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
    color: var(--a-primary);
    font-weight: var(--a-weight-base);
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
