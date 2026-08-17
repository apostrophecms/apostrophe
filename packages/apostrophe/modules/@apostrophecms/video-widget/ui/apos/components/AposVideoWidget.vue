<template>
  <div
    v-if="showEmptyState"
    class="apos-video-widget"
    @mousedown="focusWidget"
  >
    <div class="apos-video-widget__empty">
      <div class="apos-video-widget__empty-inner">
        <AposIndicator
          class="apos-video-widget__icon"
          :icon-size="70"
          icon="play-box-icon"
        />
        <p
          :id="instructionsId"
          class="apos-video-widget__instructions"
        >
          {{ $t('apostrophe:videoEmptyStateMsg') }}
        </p>
        <form
          class="apos-video-widget__form"
          novalidate
          :aria-labelledby="instructionsId"
          @submit.prevent="submit"
        >
          <div class="apos-video-widget__controls">
            <div
              class="apos-video-widget__field"
              :class="{ 'apos-field--error': error }"
            >
              <label
                class="apos-sr-only"
                :for="inputId"
              >
                {{ $t('apostrophe:videoUrl') }}
              </label>
              <input
                :id="inputId"
                v-model="url"
                class="apos-input apos-input--oembed"
                type="url"
                :placeholder="$t('apostrophe:videoUrl')"
                :disabled="submitting"
                :aria-invalid="error ? 'true' : 'false'"
                :aria-describedby="error ? errorId : undefined"
                required
              >
            </div>
            <AposButton
              type="primary"
              label="apostrophe:addVideo"
              button-type="submit"
              :busy="submitting"
              :disabled="submitting"
            />
          </div>
          <p
            v-if="error"
            :id="errorId"
            class="apos-video-widget__error"
            aria-live="polite"
            data-apos-test="field-error"
          >
            {{ error }}
          </p>
        </form>
      </div>
    </div>
  </div>
  <!-- eslint-disable vue/no-v-html -->
  <div
    v-else
    class="apos-video-widget"
    :class="getClasses"
  >
    <div
      class="apos-video-widget__embed"
      inert
      v-html="rendered"
    />
    <div
      v-if="hasVideo"
      class="apos-video-widget__edit-overlay"
    >
      <p class="apos-video-widget__edit-overlay-msg">
        {{ $t('apostrophe:videoCannotPlayInEditMode') }}
      </p>
    </div>
  </div>
</template>

<script setup>
import {
  computed, inject, ref, watch
} from 'vue';
import { useAposWidget } from 'Modules/@apostrophecms/widget-type/composables/AposWidget.js';
import aposWidgetProps from 'Modules/@apostrophecms/widget-type/composables/AposWidgetProps.js';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget';

const props = defineProps(aposWidgetProps);
const emit = defineEmits([ 'edit', 'update' ]);
const $t = inject('i18n');
const widgetStore = useWidgetStore();
const widgetModuleOptions = apos.modules[`${props.type}-widget`];

const {
  getClasses, renderContent, rendered
} = useAposWidget(props);

const url = ref('');
const error = ref('');
const submitting = ref(false);

const showEmptyState = computed(() => {
  return props.modelValue?.aposPlaceholder === true &&
    !widgetModuleOptions.placeholderUrl;
});

const hasVideo = computed(() => {
  return Boolean(props.modelValue?.video?.url) ||
    Boolean(props.modelValue?.aposPlaceholder && widgetModuleOptions.placeholderUrl);
});

const inputId = computed(() => {
  return `apos-video-widget-url-${props.modelValue?._id || 'new'}`;
});

const instructionsId = computed(() => `${inputId.value}-instructions`);

const errorId = computed(() => `${inputId.value}-error`);

function focusWidget(event) {
  const areaId = event.currentTarget.closest('[data-apos-area]')
    ?.getAttribute('data-apos-area');
  if (!areaId || !props.modelValue?._id) {
    return;
  }
  widgetStore.setFocusedWidget(props.modelValue._id, areaId);
}

watch(() => props.modelValue, async () => {
  if (!showEmptyState.value) {
    await renderContent();
  }
}, { immediate: true });

async function submit() {
  const nextUrl = (url.value || '').trim();
  if (!nextUrl) {
    error.value = $t('apostrophe:required');
    return;
  }

  error.value = '';
  submitting.value = true;

  try {
    const result = await apos.http.get(`${apos.oembed.action}/query`, {
      busy: true,
      qs: {
        url: nextUrl
      }
    });

    if (result.type && result.type !== 'video') {
      error.value = $t('apostrophe:oembedTypeNotSupported');
      return;
    }

    emit('update', {
      ...props.modelValue,
      video: {
        url: nextUrl,
        title: result.title || '',
        thumbnail: result.thumbnail_url || ''
      }
    });
  } catch (e) {
    error.value = e.body?.message
      ? e.body.message
      : $t('apostrophe:oembedInvalidEmbedUrl');
  } finally {
    submitting.value = false;
  }
}
</script>

<style>
.apos-is-highlighted .apos-video-widget__empty,
.apos-is-focused .apos-video-widget__empty {
  /* stylelint-disable-next-line declaration-no-important */
  outline-color: transparent !important;
}
</style>
<style lang="scss" scoped>
.apos-video-widget {
  z-index: $z-index-base;
  position: relative;
}

.apos-video-widget__empty {
  position: relative;
  display: flex;
  overflow: hidden;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  min-height: 350px;
  border-radius: var(--a-border-radius);
  outline: 1px dashed var(--a-base-5);
  color: inherit;
  font-family: var(--a-family-default);
  background-color: var(--a-base-10);
}

.apos-video-widget__empty::before {
  content: '';
  z-index: $z-index-base;
  position: absolute;
  inset: 0;
  background: rgba(255 255 255 / 70%);
}

.apos-video-widget__empty-inner {
  z-index: $z-index-default;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 20px;
}

.apos-video-widget__icon {
  @include apos-transition($duration: 0.2s);

  :deep(svg) {
    fill: var(--a-base-7);
  }
}

.apos-video-widget__instructions {
  margin: 10px 0 15px;
  font-size: var(--a-type-heading);
  text-align: center;
  white-space: nowrap;
}

.apos-video-widget__form {
  width: 100%;
  max-width: 480px;
}

.apos-video-widget__controls {
  display: flex;
  gap: 10px;
  align-items: stretch;
  width: 100%;
}

.apos-video-widget__field {
  flex: 1 1 auto;
}

.apos-video-widget__controls :deep(.apos-button__wrapper) {
  display: flex;
}

.apos-video-widget__controls :deep(.apos-button) {
  display: flex;
  box-sizing: border-box;
  align-items: center;
  height: 100%;
}

.apos-video-widget__error {
  @include type-help;

  & {
    margin: $spacing-base 0 0;
    color: var(--a-danger);
  }
}

.apos-video-widget__embed {
  :deep(iframe),
  :deep([data-apos-video-canvas]) {
    filter: grayscale(1);
  }
}

.apos-video-widget__edit-overlay {
  z-index: $z-index-default;
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255 255 255 / 70%);
}

.apos-video-widget__edit-overlay-msg {
  margin: 0;
  padding: 8px 12px;
  border-radius: var(--a-border-radius);
  background-color: var(--a-background-primary);
  color: var(--a-text-primary);
  font-size: var(--a-type-large);
  text-align: center;
}
</style>
