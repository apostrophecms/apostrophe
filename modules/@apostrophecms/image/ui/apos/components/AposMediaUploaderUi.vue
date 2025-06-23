<template>
  <div
    ref="mediaUploaderEl"
    class="apos-media-uploader"
    :class="{'apos-media-uploader--enabled': !props.disabled}"
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
  </div>
</template>

<script setup>
import {
  inject, useTemplateRef, onMounted
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
  }
});
const emit = defineEmits([ 'media', 'upload' ]);
const mediaUploaderEl = useTemplateRef('mediaUploaderEl');

const mediaLibraryTranslation = $t('apostrophe:mediaLibrary');
const yourDeviceTranslation = $t('apostrophe:yourDevice');
const instructionsTranslation = $t('apostrophe:imageUploadMsg', {
  mediaLibrary: `<button class="apos-media-uploader__btn" data-apos-click="openMedia">${mediaLibraryTranslation}</button>`,
  yourDevice: `<button class="apos-media-uploader__btn" data-apos-click="searchFile">${yourDeviceTranslation}</button>`
});
const minSizeTranslation = props.minSize && $t('apostrophe:mininumSize', {
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
const acceptTranslation = $t('apostrophe:imageUploadSupport', {
  formats,
  last: `<strong>${formattedAccept[formattedAccept.length - 1]}</strong>`
});

onMounted(() => {
  bindEmits();
});

function bindEmits() {
  mediaUploaderEl.value.querySelectorAll('[data-apos-emit]').forEach((el) => {
    el.addEventListener('click', (event) => {
      const action = event.currentTarget.getAttribute('data-apos-emit');
      emit(action);
    });
  });

}
</script>

<style lang="scss">
.apos-media-uploader {
  @include apos-button-reset();
  @include apos-transition();

  & {
    display: flex;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    border: 2px dashed var(--a-base-3);
    color: inherit;
    grid-column: 1 / 3;
    grid-row: 1 / 3;
  }
}

.apos-media-uploader--enabled .apos-media-uploader__inner {
  &::after {
    @include apos-transition($duration: 0.3s);

    & {
      z-index: $z-index-under;
      position: absolute;
      content: '';
      width: 90%;
      height: 90%;
      background-image:
        linear-gradient(to right, rgba($brand-magenta, 0.3), rgba($brand-blue, 0.3)),
        linear-gradient(to right, rgba($brand-gold, 0.3), rgba($brand-magenta, 0.3));
      background-size:
        100% 60%,
        100% 60%;
      background-position:
        5% -5%,
        5% 100%;
      background-repeat: no-repeat;
      filter: blur(10px);
    }
  }

  &:hover,
  &:active,
  &:focus,
  &.apos-is-dragging {
    outline: 2px dashed var(--a-primary);

    &::after {
      width: 102%;
      height: 102%;
    }

    .apos-media-uploader__icon svg {
      /* fill: url("#apos-upload-gradient"); */
      transform: translateY(0);
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

  svg {
    fill: var(--a-base-8);
  }
}

.apos-media-uploader__instructions {
  margin: 10px 0 15px;
  font-size: var(--a-type-heading);
  max-width: 360px;
  text-align: center;
}

.apos-media-uploader__btn {
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
