<template>
  <div
    v-if="!hasImage"
    class="apos-image-widget"
  >
    <AposMediaUploaderUi
      :min-size="[100, 100]"
      :accept="accept"
      @upload="upload"
      @media="openMedia"
    />
  </div>
  <div
    v-else
    :class="getClasses"
    v-html="rendered"
  />
</template>

<script setup>
import {
  computed, watch, onMounted
} from 'vue';
import { useAposWidget } from 'Modules/@apostrophecms/widget-type/composables/AposWidget';
import aposWidgetProps from 'Modules/@apostrophecms/widget-type/composables/AposWidgetProps';

const moduleOptions = window.apos.modules['@apostrophecms/image'];
const accept = moduleOptions.schema.find(field => field.name === 'attachment').accept;

const emit = defineEmits([ 'edit' ]);

const props = defineProps(aposWidgetProps);
const {
  getClasses, renderContent, rendered
} = useAposWidget(props);

const hasImage = computed(() => {
  return Boolean(props.modelValue?._image?.length);
});

watch(props.modelValue, () => {
  if (hasImage.value) {
    renderContent();
  }
});

onMounted(() => {
  if (hasImage.value) {
    renderContent();
  }
});

function openMedia() {
  console.log('=====> open media <=====');
}

async function upload(files = []) {
  console.log('=====> upload <=====');
  const [ file ] = files;
  if (!file) {
    return;
  }

  try {
    const emptyDoc = await apos.http.post(moduleOptions.action, {
      busy: true,
      body: {
        _newInstance: true
      },
      draft: true
    });

    const formData = new window.FormData();
    formData.append('file', file);

    // Make an async request to upload the image.
    const attachment = await apos.http.post('/api/v1/@apostrophecms/attachment/upload', {
      busy: true,
      body: formData
    });

    const imageData = Object.assign(emptyDoc, {
      title: attachment.title,
      attachment
    });

    const imgPiece = await apos.http.post(moduleOptions.action, {
      busy: true,
      body: imageData,
      draft: true
    });

    console.log('imgPiece', imgPiece);
  } catch (e) {
    const msg = e.body?.message ? e.body.message : this.$t('apostrophe:uploadError');
    await apos.notify(msg, {
      type: 'danger',
      icon: 'alert-circle-icon',
      dismiss: true,
      localize: false
    });
  }
}
</script>

<style lang="scss" scoped>
.apos-image-widget {
  position: relative;
}
</style>
