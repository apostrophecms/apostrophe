<template>
  <div
    v-if="!hasImage"
    class="apos-image-widget"
  >
    <AposMediaUploaderUi
      :min-size="props.options?.minSize"
      :accept="accept"
      :placeholder="widgetModuleOptions.placeholderUrl"
      @upload="upload"
      @media="selectFromManager"
    />
  </div>
  <div
    v-else
    :class="getClasses"
    v-html="rendered"
  />
</template>

<script setup>
import { klona } from 'klona';
import {
  computed, watch
} from 'vue';
import { useAposWidget } from 'Modules/@apostrophecms/widget-type/composables/AposWidget';
import aposWidgetProps from 'Modules/@apostrophecms/widget-type/composables/AposWidgetProps';

const moduleOptions = apos.modules['@apostrophecms/image'];
const widgetModuleOptions = apos.modules['@apostrophecms/image-widget'];
console.log('widgetModuleOptions', widgetModuleOptions);
const accept = moduleOptions.schema.find(field => field.name === 'attachment').accept;

const emit = defineEmits([ 'edit', 'update' ]);

const props = defineProps(aposWidgetProps);
const {
  getClasses, renderContent, rendered
} = useAposWidget(props);

const hasImage = computed(() => {
  return Boolean(props.modelValue?._image?.length);
});

watch(() => props.modelValue, async (newVal) => {
  if (hasImage.value) {
    await renderContent();
  }
}, { immediate: true });

async function selectFromManager() {
  const modalItem = apos.modal.modals.find((modal) => modal.itemName === '@apostrophecms/image:manager');
  if (!modalItem) {
    return;
  }

  // This is the weird way we communicate widget options to editor / manager
  apos.area.widgetOptions = [
    klona(props.options),
    ...apos.area.widgetOptions
  ];

  const [ selectedImg ] = (await apos.modal.execute(modalItem.componentName, {
    ...modalItem.props,
    moduleName: props.type,
    chosen: [],
    relationshipField: { max: 1 }
  })) || [];

  // Once the manager closed we clean the widget options
  apos.area.widgetOptions = apos.area.widgetOptions.slice(1);

  if (selectedImg) {
    emit('update', {
      ...props.modelValue,
      _image: [ selectedImg ]
    });
  }
}

/**
 * @param {attachment} image - image or apostrophe attachment object
 * @param {number} image.width
 * @param {number} image.height
 * @returns {boolean} - boolean sayingi if image is valid
 */
function checkImageValid(image) {
  /* const aspectRatio = image.width / image.height; */
  const minSize = props.options.minSize;
  if (!minSize) {
    return true;
  }

  if (
    (minSize[0] && image.width < minSize[0]) ||
    (minSize[1] && image.height < minSize[1])
  ) {
    apos.notify('apostrophe:minimumSize', {
      type: 'danger',
      icon: 'alert-circle-icon',
      dismiss: true,
      interpolate: {
        width: minSize[0],
        height: minSize[1]
      }
    });
    return false;
  }

  return true;
}

/**
 * @param {File} file - File uploaded by user
 * @returns {boolean} - Returns a boolean telling if the image is valid
 */
async function checkFileValid(file) {
  const isValid = await new Promise((resolve, reject) => {
    if (!file) {
      return resolve(false);
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = (evt) => {
        resolve(checkImageValid(evt.target));
      };

      img.src = e.target.result; // Use the file data from FileReader
    };
    reader.onerror = () => {
      apos.notify('apostrophe:uploadError', {
        type: 'danger',
        icon: 'alert-circle-icon',
        dismiss: true
      });
      resolve(false);
    };

    reader.readAsDataURL(file);
  });

  return isValid;
}

/**
 * @param {File[]} files - Files user is uploading
 */
async function upload(files = []) {
  const [ file ] = files;
  const isValid = await checkFileValid(file);
  if (!isValid) {
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

    emit('update', {
      ...props.modelValue,
      _image: [ imgPiece ]
    });
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
