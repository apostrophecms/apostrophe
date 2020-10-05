import { withKnobs } from '@storybook/addon-knobs';
import AposModal from 'Modules/@apostrophecms/modal/components/AposModal.vue';
import AposModalRail from 'Modules/@apostrophecms/modal/components/AposModalRail.vue';
import AposModalBody from 'Modules/@apostrophecms/modal/components/AposModalBody.vue';
import AposButton from './AposButton.vue';
import AposTagList from './AposTagList.vue';

const tagListItems = getItems();

export default {
  title: 'Tag List',
  decorators: [ withKnobs ]
};

export const tagList = () => ({
  components: {
    AposTagList,
    AposModal,
    AposButton,
    AposModalRail,
    AposModalBody
  },
  data() {
    return {
      tagListItems,
      modal: {
        title: 'Media Library',
        active: true,
        type: 'overlay',
        showModal: true
      }
    };
  },
  template: `
  <div>
    <button type="button" class="apos-button">
      Media Library
    </button>
    <AposModal :modal="modal">
      <template #primaryControls>
        <AposButton type="primary" label="Close" />
      </template>
      <template #leftRail>
        <AposModalRail>
          <AposTagList title="Image Tags" :tags="tagListItems" />
        </AposModalRail>
      </template>
      <template #main>
        <AposModalBody>
          <template #bodyHeader>
            <AposButton label="Exit" :iconOnly="true"  icon="label-icon" type="outline" />
            <AposButton label="Exit" :iconOnly="true"  icon="dots-vertical-icon" type="outline" />
            <AposButton label="Exit" :iconOnly="true"  icon="delete-icon" type="outline" />
            <AposButton label="Exit" :iconOnly="true"  icon="checkbox-blank-icon" type="outline" />
          </template>
          <template #bodyMain>
            Hi :)
          </template>
        </AposModalBody>
      </template>
    </AposModal>
  </div>
  `
});

function getItems() {
  return [
    {
      label: 'Good Morning',
      slug: 'good-morning',
      value: 'Ultricies'
    },
    {
      label: 'goodvibes',
      slug: 'goodvibes',
      value: 'Tortor'
    },
    {
      label: 'GOOD',
      slug: 'good',
      value: 'Pharetra'
    },
    {
      label: 'Good Night Moon The Book',
      slug: 'good-night',
      value: 'Fermentum'
    },
    {
      label: 'goodmood',
      slug: 'goodmood',
      value: 'Venenatis'
    },
    {
      label: 'Goodweather',
      slug: 'goodweather',
      value: 'Egestas'
    },
    {
      label: 'good boy',
      slug: 'good-boy',
      value: 'Consectetur'
    }
  ];
}
